import { cartItems, carts, productImages, productPrices, products } from "@async-rent/db";
import type {
  CartItemRow,
  CartRow,
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
} from "@async-rent/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type {
  AddCartItem,
  Cart,
  CartItem,
  ChargeSummary,
  RemoveCartItem,
  UpdateCartItemQuantity,
} from "../types";
import { cartSchema } from "../types";
import { createResult } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

/**
 * The visitor's cart, priced by the city it is in.
 *
 * One cart holds one city's gear, so `addItem` never mixes cities into a cart:
 * a mismatched city on an existing cart is rejected rather than re-priced. A
 * cart is also single-currency, matching `chargeSummarySchema`.
 *
 * Line prices are snapshotted from the cart's city when a product is added, so
 * a later catalog edit never rewrites a line. The delivery fee is the one
 * amount that is not a line price; it is read from the cart's city on every
 * total, and every operation recomputes the totals rather than trusting the
 * summary stored on the row. A cart therefore has exactly one total — what a
 * read returns is what the next write would store, and what a checkout captures.
 */

function toCartItem(row: CartItemRow): CartItem {
  return {
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    image: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt ?? undefined } : undefined,
    quantity: row.quantity,
    weeklyPrice: row.weeklyPrice,
    deposit: row.deposit ?? undefined,
  };
}

function toCart(row: CartRow, itemRows: CartItemRow[]): Cart {
  return {
    id: row.id,
    customerId: row.customerId ?? undefined,
    locationId: row.locationId,
    items: [...itemRows].sort((a, b) => a.position - b.position).map(toCartItem),
    summary: {
      currency: row.currency,
      weeklySubtotal: row.weeklySubtotal,
      deposit: row.deposit,
      deliveryFee: row.deliveryFee,
      discount: row.discount,
      totalDueToday: row.totalDueToday,
      recurringWeekly: row.recurringWeekly,
    },
    expiresAt: row.expiresAt?.toISOString(),
  };
}

function distinctProductIds(items: CartItemRow[]): string[] {
  return [...new Set(items.map((item) => item.productId))];
}

/** The position a new line takes: after every line already in the cart. */
function nextPosition(items: CartItemRow[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
}

/**
 * The delivery fee is charged once for the whole order — the gear ships in one
 * trip — so it is the highest per-line fee, not a sum that would grow with the
 * number of lines. A product with no fee in the city contributes nothing.
 */
function deliveryFeeFor(items: CartItemRow[], feeByProduct: Map<string, number>): number {
  return items.reduce((max, item) => Math.max(max, feeByProduct.get(item.productId) ?? 0), 0);
}

/**
 * Rolls the lines up into the cart's money. Deposits are per unit like the
 * weekly price; the delivery fee is per order; only the weekly subtotal bills
 * again after the first week.
 */
function summarize(
  cart: CartRow,
  items: CartItemRow[],
  feeByProduct: Map<string, number>,
): ChargeSummary {
  const weeklySubtotal = items.reduce((sum, item) => sum + item.weeklyPrice * item.quantity, 0);
  const deposit = items.reduce((sum, item) => sum + (item.deposit ?? 0) * item.quantity, 0);
  const deliveryFee = deliveryFeeFor(items, feeByProduct);
  const discount = cart.discount;

  return {
    currency: cart.currency,
    weeklySubtotal,
    deposit,
    deliveryFee,
    discount,
    totalDueToday: weeklySubtotal + deposit + deliveryFee - discount,
    recurringWeekly: weeklySubtotal,
  };
}

/**
 * How many times an add re-reads and retries after a failed write. A racing add
 * can claim a position first; the retry then finds that line and merges instead
 * of failing the whole call.
 */
const maxWriteAttempts = 3;

/** A cart shaped for a caller, or why it could not be. */
type CartRead =
  | { status: "ok"; cart: Cart }
  | { status: "not_found" }
  | { status: "read_failed" }
  | { status: "invalid" };

export function createCartService({ db }: CreateCartServiceOptions) {
  const getCartResult = createResult(
    cartSchema,
    z.enum(["cart_not_found", "failed_to_fetch_cart", "cart_data_invalid"]),
  );

  const addItemResult = createResult(
    cartSchema,
    z.enum([
      "cart_not_found",
      "cart_forbidden",
      "cart_city_mismatch",
      "cart_currency_mismatch",
      "product_not_available",
      "failed_to_fetch_product",
      "failed_to_fetch_cart",
      "failed_to_save_cart",
      "cart_data_invalid",
    ]),
  );

  const updateItemQuantityResult = createResult(
    cartSchema,
    z.enum([
      "cart_not_found",
      "cart_item_not_found",
      "failed_to_fetch_cart",
      "failed_to_save_cart",
      "cart_data_invalid",
    ]),
  );

  const removeItemResult = createResult(
    cartSchema,
    z.enum([
      "cart_not_found",
      "cart_item_not_found",
      "failed_to_fetch_cart",
      "failed_to_save_cart",
      "cart_data_invalid",
    ]),
  );

  /** The shared failed branch of a read that did not produce a valid cart. */
  function failedRead(read: CartRead, key: string) {
    if (read.status === "not_found")
      return { code: "cart_not_found", message: `Cart ${key} not found` } as const;
    if (read.status === "read_failed")
      return { code: "failed_to_fetch_cart", message: "Failed to fetch cart" } as const;

    return { code: "cart_data_invalid", message: `Cart ${key} has invalid data` } as const;
  }

  /** The cart row, or `undefined` when no cart has that id. */
  async function loadCartRow(cartId: string): Promise<CartRow | null | undefined> {
    const rows = await db
      .select()
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1)
      .catch(() => null);

    if (!rows) return null;

    return rows[0];
  }

  /** A signed-in visitor's cart for a city, so they never accumulate two. */
  async function findCartForCustomer(
    customerId: string,
    locationId: string,
  ): Promise<CartRow | null | undefined> {
    const rows = await db
      .select()
      .from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.locationId, locationId)))
      .orderBy(desc(carts.createdAt), desc(carts.id))
      .limit(1)
      .catch(() => null);

    if (!rows) return null;

    return rows[0];
  }

  /** Loads a cart and its lines in one round trip. */
  async function loadCart(
    cartId: string,
  ): Promise<{ row: CartRow; items: CartItemRow[] } | null | undefined> {
    const batch = await db
      .batch([
        db.select().from(carts).where(eq(carts.id, cartId)).limit(1),
        db
          .select()
          .from(cartItems)
          .where(eq(cartItems.cartId, cartId))
          .orderBy(asc(cartItems.position)),
      ])
      .catch(() => null);

    if (!batch) return null;

    const [cartRows, itemRows] = batch;
    const row = cartRows[0];
    if (!row) return undefined;

    return { row, items: itemRows };
  }

  /**
   * Delivers the per-city delivery fees the summary needs, keyed by product.
   * Delivery is the one amount not snapshotted on a line, so it is read from
   * the cart's city on every total.
   */
  async function loadDeliveryFees(
    locationId: string,
    productIds: string[],
  ): Promise<Map<string, number> | null> {
    if (productIds.length === 0) return new Map();

    const rows = await db
      .select({ productId: productPrices.productId, deliveryFee: productPrices.deliveryFee })
      .from(productPrices)
      .where(
        and(inArray(productPrices.productId, productIds), eq(productPrices.locationId, locationId)),
      )
      .catch(() => null);

    if (!rows) return null;

    return new Map(rows.map((row) => [row.productId, row.deliveryFee ?? 0]));
  }

  /** Recomputes a cart's money from its lines and the city's delivery fees. */
  async function summarizeFor(cart: CartRow, items: CartItemRow[]): Promise<ChargeSummary | null> {
    const fees = await loadDeliveryFees(cart.locationId, distinctProductIds(items));

    if (!fees) return null;

    return summarize(cart, items, fees);
  }

  /**
   * The one way a cart reaches a caller: re-read the row, recompute its totals,
   * and only shape the domain cart once it parses. Every operation ends here,
   * so a row the domain schema rejects is a `cart_data_invalid` failure, never
   * a `ZodError` thrown out of `success()`.
   */
  async function readCart(cartId: string): Promise<CartRead> {
    const loaded = await loadCart(cartId);
    if (loaded === null) return { status: "read_failed" };
    if (!loaded) return { status: "not_found" };

    const summary = await summarizeFor(loaded.row, loaded.items);
    if (!summary) return { status: "read_failed" };

    const cart = toCart({ ...loaded.row, ...summary }, loaded.items);

    return cartSchema.safeParse(cart).success ? { status: "ok", cart } : { status: "invalid" };
  }

  interface ProductOffer {
    product: ProductRow;
    price: ProductPriceRow;
    image: ProductImageRow | undefined;
  }

  /**
   * The active product and the price it rents for in one city, plus its first
   * photo for the line snapshot, all in one round trip.
   */
  async function loadOffer(
    productId: string,
    locationId: string,
  ): Promise<{ ok: true; offer?: ProductOffer } | { ok: false }> {
    const batch = await db
      .batch([
        db
          .select()
          .from(productPrices)
          .where(
            and(eq(productPrices.productId, productId), eq(productPrices.locationId, locationId)),
          )
          .limit(1),
        db
          .select()
          .from(products)
          .where(and(eq(products.id, productId), eq(products.status, "active")))
          .limit(1),
        db
          .select()
          .from(productImages)
          .where(eq(productImages.productId, productId))
          .orderBy(asc(productImages.position))
          .limit(1),
      ])
      .catch(() => null);

    if (!batch) return { ok: false };

    const [priceRows, productRows, imageRows] = batch;
    const price = priceRows[0];
    const product = productRows[0];

    if (!price || !product) return { ok: true };

    return { ok: true, offer: { product, price, image: imageRows[0] } };
  }

  async function createCartRow(input: {
    customerId?: string;
    locationId: string;
    currency: string;
  }): Promise<CartRow | null> {
    const row: CartRow = {
      id: `cart_${crypto.randomUUID()}`,
      customerId: input.customerId ?? null,
      locationId: input.locationId,
      currency: input.currency,
      weeklySubtotal: 0,
      deposit: 0,
      deliveryFee: 0,
      discount: 0,
      totalDueToday: 0,
      recurringWeekly: 0,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: null,
    };

    const saved = await db
      .insert(carts)
      .values(row)
      .catch(() => null);
    if (!saved) return null;

    return row;
  }

  /** Reads a cart back the way the apps see it, empty cart included. */
  async function getCart(cartId: string): Promise<z.infer<(typeof getCartResult)["schema"]>> {
    const { success, failed } = getCartResult;

    const read = await readCart(cartId);
    if (read.status === "ok") return success(read.cart);

    const failure = failedRead(read, cartId);
    return failed(failure.code, failure.message);
  }

  async function addItem(input: AddCartItem): Promise<z.infer<(typeof addItemResult)["schema"]>> {
    const { success, failed } = addItemResult;
    const { cartId, customerId, locationId, productId, quantity } = input;

    // Find the visitor's cart, or remember to open one once the offer checks out.
    let row: CartRow | undefined;

    if (cartId) {
      const found = await loadCartRow(cartId);
      if (found === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");
      if (!found) return failed("cart_not_found", `Cart ${cartId} not found`);

      if (locationId !== found.locationId)
        return failed("cart_city_mismatch", `Cart ${cartId} is for another city`);
      if (found.customerId && customerId && found.customerId !== customerId)
        return failed("cart_forbidden", `Cart ${cartId} belongs to another customer`);

      row = found;
    } else if (customerId) {
      const existing = await findCartForCustomer(customerId, locationId);
      if (existing === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");
      row = existing;
    }

    // The product must be active and priced in the cart's city to be rentable.
    const loaded = await loadOffer(productId, locationId);
    if (!loaded.ok) return failed("failed_to_fetch_product", "Failed to fetch product");
    if (!loaded.offer)
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${locationId}`,
      );

    const { product, price, image } = loaded.offer;

    // Open the cart on the first add; a cart never mixes currencies.
    if (!row) {
      const created = await createCartRow({
        customerId,
        locationId,
        currency: price.currency,
      });
      if (!created) return failed("failed_to_save_cart", "Failed to save cart");

      row = created;
    } else if (row.currency !== price.currency) {
      return failed("cart_currency_mismatch", `Cart ${row.id} is priced in ${row.currency}`);
    }

    // A signed-in visitor claims an unowned cart, so their gear stays in one
    // cart once they sign in instead of splitting off a second one.
    const owner = row.customerId ?? customerId;

    for (let attempt = 0; attempt < maxWriteAttempts; attempt++) {
      const loadedCart = await loadCart(row.id);
      if (loadedCart === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");
      if (!loadedCart) return failed("cart_not_found", `Cart ${row.id} not found`);

      const { items } = loadedCart;
      const existingLine = items.find((item) => item.productId === productId);

      let mergedItems: CartItemRow[];
      let lineWrite;

      if (existingLine) {
        // A repeated product merges with a relative increment, so two
        // overlapping adds both count instead of writing the same total over
        // each other.
        mergedItems = items.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
        );
        lineWrite = db
          .update(cartItems)
          .set({ quantity: sql`${cartItems.quantity} + ${quantity}` })
          .where(and(eq(cartItems.cartId, row.id), eq(cartItems.productId, productId)));
      } else {
        const newLine: CartItemRow = {
          cartId: row.id,
          position: nextPosition(items),
          productId: product.id,
          name: product.name,
          slug: product.slug,
          imageUrl: image?.url ?? null,
          imageAlt: image?.alt ?? null,
          quantity,
          weeklyPrice: price.weeklyPrice,
          deposit: price.deposit ?? null,
        };

        mergedItems = [...items, newLine];
        lineWrite = db.insert(cartItems).values(newLine);
      }

      const summary = await summarizeFor(row, mergedItems);
      if (!summary) return failed("failed_to_fetch_cart", "Failed to fetch cart");

      const saved = await db
        .batch([
          lineWrite,
          db
            .update(carts)
            .set({ ...summary, ...(owner ? { customerId: owner } : {}), updatedAt: new Date() })
            .where(eq(carts.id, row.id)),
        ])
        .catch(() => null);

      if (saved) {
        const read = await readCart(row.id);
        if (read.status === "ok") return success(read.cart);

        const failure = failedRead(read, row.id);
        return failed(failure.code, failure.message);
      }
    }

    return failed("failed_to_save_cart", "Failed to save cart");
  }

  async function updateItemQuantity(
    input: UpdateCartItemQuantity,
  ): Promise<z.infer<(typeof updateItemQuantityResult)["schema"]>> {
    const { success, failed } = updateItemQuantityResult;
    const { cartId, productId, quantity } = input;

    const loaded = await loadCart(cartId);
    if (loaded === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");
    if (!loaded) return failed("cart_not_found", `Cart ${cartId} not found`);

    const { row, items } = loaded;
    const line = items.find((item) => item.productId === productId);
    if (!line)
      return failed("cart_item_not_found", `Product ${productId} is not in cart ${cartId}`);

    const nextItems = items.map((item) =>
      item.productId === productId ? { ...item, quantity } : item,
    );

    const summary = await summarizeFor(row, nextItems);
    if (summary === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");

    const saved = await db
      .batch([
        db
          .update(cartItems)
          .set({ quantity })
          .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId))),
        db
          .update(carts)
          .set({ ...summary, updatedAt: new Date() })
          .where(eq(carts.id, cartId)),
      ])
      .catch(() => null);
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    const read = await readCart(cartId);
    if (read.status === "ok") return success(read.cart);

    const failure = failedRead(read, cartId);
    return failed(failure.code, failure.message);
  }

  async function removeItem(
    input: RemoveCartItem,
  ): Promise<z.infer<(typeof removeItemResult)["schema"]>> {
    const { success, failed } = removeItemResult;
    const { cartId, productId } = input;

    const loaded = await loadCart(cartId);
    if (loaded === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");
    if (!loaded) return failed("cart_not_found", `Cart ${cartId} not found`);

    const { row, items } = loaded;
    const line = items.find((item) => item.productId === productId);
    if (!line)
      return failed("cart_item_not_found", `Product ${productId} is not in cart ${cartId}`);

    const remaining = items.filter((item) => item.productId !== productId);

    const summary = await summarizeFor(row, remaining);
    if (summary === null) return failed("failed_to_fetch_cart", "Failed to fetch cart");

    const saved = await db
      .batch([
        db
          .delete(cartItems)
          .where(and(eq(cartItems.cartId, cartId), eq(cartItems.position, line.position))),
        db
          .update(carts)
          .set({ ...summary, updatedAt: new Date() })
          .where(eq(carts.id, cartId)),
      ])
      .catch(() => null);
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    const read = await readCart(cartId);
    if (read.status === "ok") return success(read.cart);

    const failure = failedRead(read, cartId);
    return failed(failure.code, failure.message);
  }

  return {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
  };
}
