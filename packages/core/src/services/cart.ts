import type { CartItemRow, CartRow } from "@async-rent/db";
import { cartItems, carts, locations, productPrices, products } from "@async-rent/db";
import { and, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type { Cart, CartItem, ChargeSummary } from "../types";
import { cartSchema } from "../types";
import { createResult } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

/**
 * A cart, stored whole.
 *
 * The caller hands over a complete `Cart` — its shape is validated before it
 * gets here — and this service only enforces what the aggregate cannot say on
 * its own:
 *
 * - the cart's city exists, and every line is an active product priced there;
 * - the cart's currency is the currency the city quotes those lines in;
 * - the delivery fee is charged once per order, not per line;
 * - the summary is exactly what the lines and that fee add up to.
 *
 * Everything else is stored as given: line prices are the snapshot the caller
 * took, so a later catalog edit never rewrites a line, and `updateCart` is a
 * full replacement of the stored cart rather than a diff.
 */

/** What a city knows about a product: the currency and the per-order fee. */
interface CityOffer {
  currency: string;
  deliveryFee: number;
}

/** A cart that passed the business rules, or the first rule it broke. */
type CartCheck =
  | { status: "ok" }
  | { status: "read_failed" }
  | { status: "location_not_found" }
  | { status: "product_not_available"; productId: string }
  | { status: "currency_mismatch"; productId: string; currency: string }
  | { status: "summary_mismatch" };

type CartCheckFailure = Exclude<CartCheck, { status: "ok" }>;

/**
 * The money the lines and the city's delivery fees add up to. Deposits are per
 * unit like the weekly price; the delivery fee is the highest per-line fee, not
 * a sum that grows with the number of lines; only the weekly subtotal bills
 * again after the first week.
 */
function summarize(cart: Cart, offers: Map<string, CityOffer>): ChargeSummary {
  const { items, summary } = cart;
  const weeklySubtotal = items.reduce((sum, item) => sum + item.weeklyPrice * item.quantity, 0);
  const deposit = items.reduce((sum, item) => sum + (item.deposit ?? 0) * item.quantity, 0);
  const deliveryFee = items.reduce(
    (max, item) => Math.max(max, offers.get(item.productId)?.deliveryFee ?? 0),
    0,
  );

  return {
    currency: summary.currency,
    weeklySubtotal,
    deposit,
    deliveryFee,
    discount: summary.discount,
    totalDueToday: weeklySubtotal + deposit + deliveryFee - summary.discount,
    recurringWeekly: weeklySubtotal,
  };
}

/** Whether a caller's summary is the one its lines produce. */
function summaryMatches(actual: ChargeSummary, expected: ChargeSummary): boolean {
  return (
    actual.currency === expected.currency &&
    actual.weeklySubtotal === expected.weeklySubtotal &&
    actual.deposit === expected.deposit &&
    actual.deliveryFee === expected.deliveryFee &&
    actual.discount === expected.discount &&
    actual.totalDueToday === expected.totalDueToday &&
    actual.recurringWeekly === expected.recurringWeekly
  );
}

function toCartRow(cart: Cart, createdAt: Date, updatedAt: Date | null): CartRow {
  return {
    id: cart.id,
    customerId: cart.customerId ?? null,
    locationId: cart.locationId,
    currency: cart.summary.currency,
    weeklySubtotal: cart.summary.weeklySubtotal,
    deposit: cart.summary.deposit,
    deliveryFee: cart.summary.deliveryFee,
    discount: cart.summary.discount,
    totalDueToday: cart.summary.totalDueToday,
    recurringWeekly: cart.summary.recurringWeekly,
    expiresAt: cart.expiresAt ? new Date(cart.expiresAt) : null,
    createdAt,
    updatedAt,
  };
}

/** The lines as rows, in the order the caller listed them. */
function toCartItemRows(cartId: string, items: CartItem[]): CartItemRow[] {
  return items.map((item, position) => ({
    cartId,
    position,
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    imageUrl: item.image?.url ?? null,
    imageAlt: item.image?.alt ?? null,
    quantity: item.quantity,
    weeklyPrice: item.weeklyPrice,
    deposit: item.deposit ?? null,
  }));
}

export function createCartService({ db }: CreateCartServiceOptions) {
  const createCartResult = createResult(
    cartSchema,
    z.enum([
      "cart_already_exists",
      "cart_currency_mismatch",
      "cart_summary_mismatch",
      "location_not_found",
      "product_not_available",
      "failed_to_validate_cart",
      "failed_to_save_cart",
    ]),
  );

  const updateCartResult = createResult(
    cartSchema,
    z.enum([
      "cart_not_found",
      "cart_currency_mismatch",
      "cart_summary_mismatch",
      "location_not_found",
      "product_not_available",
      "failed_to_validate_cart",
      "failed_to_save_cart",
    ]),
  );

  /** Maps a broken rule onto the caller's error codes. */
  function failureFor(check: CartCheckFailure, cart: Cart) {
    switch (check.status) {
      case "read_failed":
        return { code: "failed_to_validate_cart", message: "Failed to validate cart" } as const;
      case "location_not_found":
        return {
          code: "location_not_found",
          message: `Location ${cart.locationId} not found`,
        } as const;
      case "product_not_available":
        return {
          code: "product_not_available",
          message: `Product ${check.productId} is not available in ${cart.locationId}`,
        } as const;
      case "currency_mismatch":
        return {
          code: "cart_currency_mismatch",
          message: `Product ${check.productId} is priced in ${check.currency}, not ${cart.summary.currency}`,
        } as const;
      case "summary_mismatch":
        return {
          code: "cart_summary_mismatch",
          message: `Cart ${cart.id} summary does not match its lines`,
        } as const;
    }
  }

  /**
   * The city's rentable products, keyed by product id: active products that
   * have a price there, with the currency and delivery fee that price carries.
   * One round trip, so a check costs two statements however many lines the cart
   * holds.
   */
  async function loadOffers(
    locationId: string,
    productIds: string[],
  ): Promise<Map<string, CityOffer> | null> {
    if (productIds.length === 0) return new Map();

    const batch = await db
      .batch([
        db
          .select({
            productId: productPrices.productId,
            currency: productPrices.currency,
            deliveryFee: productPrices.deliveryFee,
          })
          .from(productPrices)
          .where(
            and(
              inArray(productPrices.productId, productIds),
              eq(productPrices.locationId, locationId),
            ),
          ),
        db
          .select({ id: products.id })
          .from(products)
          .where(and(inArray(products.id, productIds), eq(products.status, "active"))),
      ])
      .catch(() => null);

    if (!batch) return null;

    const [priceRows, activeRows] = batch;
    const active = new Set(activeRows.map((row) => row.id));
    const offers = new Map<string, CityOffer>();

    for (const row of priceRows) {
      if (!active.has(row.productId)) continue;

      offers.set(row.productId, {
        currency: row.currency,
        deliveryFee: row.deliveryFee ?? 0,
      });
    }

    return offers;
  }

  /** The business rules a cart has to satisfy before it is stored. */
  async function checkCart(cart: Cart): Promise<CartCheck> {
    const locationRows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.id, cart.locationId))
      .limit(1)
      .catch(() => null);

    if (!locationRows) return { status: "read_failed" };
    if (locationRows.length === 0) return { status: "location_not_found" };

    const productIds = [...new Set(cart.items.map((item) => item.productId))];
    const offers = await loadOffers(cart.locationId, productIds);
    if (!offers) return { status: "read_failed" };

    for (const item of cart.items) {
      const offer = offers.get(item.productId);
      if (!offer) return { status: "product_not_available", productId: item.productId };
      if (offer.currency !== cart.summary.currency)
        return {
          status: "currency_mismatch",
          productId: item.productId,
          currency: offer.currency,
        };
    }

    return summaryMatches(cart.summary, summarize(cart, offers))
      ? { status: "ok" }
      : { status: "summary_mismatch" };
  }

  /**
   * Writes the cart row and its lines as one transaction. An update clears the
   * lines already stored first, so the cart on disk is the cart passed in.
   */
  async function writeCart(row: CartRow, items: CartItemRow[], replace: boolean): Promise<boolean> {
    const saved = await db
      .batch([
        replace
          ? db.update(carts).set(row).where(eq(carts.id, row.id))
          : db.insert(carts).values(row),
        ...(replace ? [db.delete(cartItems).where(eq(cartItems.cartId, row.id))] : []),
        ...(items.length > 0 ? [db.insert(cartItems).values(items)] : []),
      ])
      .catch(() => null);

    return saved !== null;
  }

  /** Stores a new cart. The id is the caller's, so it must be unused. */
  async function createCart(cart: Cart): Promise<z.infer<(typeof createCartResult)["schema"]>> {
    const { success, failed } = createCartResult;

    const existing = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cart.id))
      .limit(1)
      .catch(() => null);

    if (!existing) return failed("failed_to_validate_cart", "Failed to validate cart");
    if (existing.length > 0) return failed("cart_already_exists", `Cart ${cart.id} already exists`);

    const check = await checkCart(cart);
    if (check.status !== "ok") {
      const failure = failureFor(check, cart);
      return failed(failure.code, failure.message);
    }

    const saved = await writeCart(
      toCartRow(cart, new Date(), null),
      toCartItemRows(cart.id, cart.items),
      false,
    );
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success(cart);
  }

  /** Replaces a stored cart with the caller's version of it. */
  async function updateCart(cart: Cart): Promise<z.infer<(typeof updateCartResult)["schema"]>> {
    const { success, failed } = updateCartResult;

    const existing = await db
      .select({ createdAt: carts.createdAt })
      .from(carts)
      .where(eq(carts.id, cart.id))
      .limit(1)
      .catch(() => null);

    if (!existing) return failed("failed_to_validate_cart", "Failed to validate cart");

    const [row] = existing;
    if (!row) return failed("cart_not_found", `Cart ${cart.id} not found`);

    const check = await checkCart(cart);
    if (check.status !== "ok") {
      const failure = failureFor(check, cart);
      return failed(failure.code, failure.message);
    }

    const saved = await writeCart(
      toCartRow(cart, row.createdAt, new Date()),
      toCartItemRows(cart.id, cart.items),
      true,
    );
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success(cart);
  }

  return {
    createCart,
    updateCart,
  };
}
