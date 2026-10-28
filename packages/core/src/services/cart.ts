import type { CartOwnerTypeValue } from "@async-rent/db";
import {
  cartItems,
  carts,
  locations,
  productImages,
  productPrices,
  products,
} from "@async-rent/db";
import type { SQL } from "drizzle-orm";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type { Cart, CartItem, CartOwner } from "../types";
import { cartSchema, priceCart } from "../types";
import { createResult } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

/** The longest rental a cart can ask for. */
const maxWeeks = 24;

/** The most units of one product a cart can hold. */
const maxQuantity = 30;

/**
 * The most kinds of gear a cart can hold.
 *
 * The claim of a guest cart adds up its lines in one transaction, one
 * statement per line, so the number of lines bounds how large that
 * transaction can grow.
 */
const maxLines = 25;

/**
 * The guest's session token, hashed.
 *
 * The token is the guest's only key to the cart, so the database stores its
 * hash: a leaked database gives away no live session. SHA-256 is enough here
 * because the token is random and long, not a password.
 */
async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Who owns the cart, as the two columns the `carts` row holds. */
interface OwnerKey {
  ownerType: CartOwnerTypeValue;
  ownerId: string;
}

async function ownerKey(owner: CartOwner): Promise<OwnerKey> {
  if (owner.kind === "user") {
    return { ownerType: "user", ownerId: owner.userId };
  }

  return { ownerType: "guest", ownerId: await hashSessionToken(owner.sessionToken) };
}

/**
 * The conditions that pick out one cart: by its id, or by its owner and the
 * city it is in.
 *
 * Every statement of a cart read filters on the same conditions, so a cart is
 * read the same way whether it is named by id or found by its owner.
 */
type CartScope = SQL;

function scopeById(cartId: string): CartScope {
  return eq(carts.id, cartId);
}

function scopeByOwner(key: OwnerKey, locationId: string): CartScope {
  return and(
    eq(carts.ownerType, key.ownerType),
    eq(carts.ownerId, key.ownerId),
    eq(carts.locationId, locationId),
  )!;
}

/** The cart's own row, joined with the city it prices itself from. */
interface CartRowView {
  id: string;
  ownerType: CartOwnerTypeValue;
  ownerId: string;
  locationId: string;
  weeks: number;
  currency: string;
  deliveryFee: number;
}

/** A line as it is stored, joined with what the city charges for it. */
interface CartLineView {
  productId: string;
  quantity: number;
  name: string;
  slug: string;
  status: string;
  weeklyPrice: number | null;
  deposit: number | null;
  stock: number | null;
}

/** The outcome of reading a cart: the cart, or the reason there is none. */
type CartRead = { status: "ok"; cart: Cart } | { status: "not_found" } | { status: "failed" };

export function createCartService({ db }: CreateCartServiceOptions) {
  /**
   * The two reads answer with the cart itself.
   */
  const getCartByOwnerResult = createResult(
    cartSchema,
    z.enum([
      "cart_not_found",
      "location_not_found",
      "location_not_available",
      "failed_to_load_cart",
      "failed_to_save_cart",
    ]),
  );

  const getCartByIdResult = createResult(
    cartSchema,
    z.enum(["cart_not_found", "failed_to_load_cart"]),
  );

  /**
   * The changes answer with an acknowledgement: the cart is written, and the
   * caller reads it again when it needs to see what changed.
   */
  const addItemResult = createResult(
    z.void(),
    z.enum([
      "cart_not_found",
      "product_not_available",
      "product_out_of_stock",
      "invalid_quantity",
      "cart_is_full",
      "failed_to_load_cart",
      "failed_to_save_cart",
    ]),
  );

  const setItemQuantityResult = createResult(
    z.void(),
    z.enum([
      "cart_not_found",
      "cart_item_not_found",
      "product_not_available",
      "product_out_of_stock",
      "invalid_quantity",
      "failed_to_load_cart",
      "failed_to_save_cart",
    ]),
  );

  const removeItemResult = createResult(
    z.void(),
    z.enum(["cart_not_found", "cart_item_not_found", "failed_to_load_cart", "failed_to_save_cart"]),
  );

  const setWeeksResult = createResult(
    z.void(),
    z.enum(["cart_not_found", "invalid_weeks", "failed_to_save_cart"]),
  );

  const clearCartResult = createResult(
    z.void(),
    z.enum(["cart_not_found", "failed_to_load_cart", "failed_to_save_cart"]),
  );

  const claimCartResult = createResult(
    z.void(),
    z.enum(["cart_not_found", "cart_not_claimable", "failed_to_load_cart", "failed_to_save_cart"]),
  );

  /**
   * The cart's own row, joined with the city. One statement: the city is read
   * with the cart because every cart read needs its currency and its fee.
   */
  function cartRow(scope: CartScope) {
    return db
      .select({
        id: carts.id,
        ownerType: carts.ownerType,
        ownerId: carts.ownerId,
        locationId: carts.locationId,
        weeks: carts.weeks,
        currency: locations.currency,
        deliveryFee: locations.deliveryFee,
      })
      .from(carts)
      .innerJoin(locations, eq(locations.id, carts.locationId))
      .where(scope)
      .limit(1);
  }

  /**
   * The lines of a cart, with the city's price for each and the product's own
   * copy. A product that is archived or no longer priced in the city has no
   * price here: the line is kept, so the visitor can remove it, but it is
   * marked unavailable and stays out of the totals.
   */
  function cartLines(scope: CartScope) {
    return db
      .select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        name: products.name,
        slug: products.slug,
        status: products.status,
        weeklyPrice: productPrices.weeklyPrice,
        deposit: productPrices.deposit,
        stock: productPrices.stock,
      })
      .from(cartItems)
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .innerJoin(products, eq(products.id, cartItems.productId))
      .leftJoin(
        productPrices,
        and(
          eq(productPrices.productId, cartItems.productId),
          eq(productPrices.locationId, carts.locationId),
        ),
      )
      .where(scope)
      .orderBy(asc(products.name));
  }

  /**
   * The photos of the products in the cart, in the order the catalog shows
   * them: the first photo of a product is the one on its card.
   */
  function cartImages(scope: CartScope) {
    return db
      .select({
        productId: productImages.productId,
        url: productImages.url,
        alt: productImages.alt,
      })
      .from(productImages)
      .innerJoin(cartItems, eq(cartItems.productId, productImages.productId))
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .where(scope)
      .orderBy(asc(productImages.productId), asc(productImages.position));
  }

  /**
   * The city a cart is in, read on its own: a cart is only ever created in a
   * city that is open.
   */
  function locationRow(locationId: string) {
    return db
      .select({
        id: locations.id,
        status: locations.status,
      })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1);
  }

  /**
   * What the city charges for a product in the cart's city, and whether it can
   * be rented there at all. A product that is archived or has no price in the
   * city is not available.
   */
  function cartOffer(cartId: string, productId: string) {
    return db
      .select({
        weeklyPrice: productPrices.weeklyPrice,
        deposit: productPrices.deposit,
        stock: productPrices.stock,
      })
      .from(carts)
      .innerJoin(
        productPrices,
        and(eq(productPrices.locationId, carts.locationId), eq(productPrices.productId, productId)),
      )
      .innerJoin(
        products,
        and(eq(products.id, productPrices.productId), eq(products.status, "active")),
      )
      .where(eq(carts.id, cartId));
  }

  /** How many units of a product the cart already holds. */
  function cartQuantity(cartId: string, productId: string) {
    return db
      .select({ quantity: cartItems.quantity })
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  }

  /** How many kinds of gear the cart holds. */
  function cartLineCount(cartId: string) {
    return db.select({ value: count() }).from(cartItems).where(eq(cartItems.cartId, cartId));
  }

  /**
   * The lines of a cart with the city's price for each, without the product's
   * own copy: what a claim adds up.
   */
  function cartPricedLines(scope: CartScope) {
    return db
      .select({
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        weeklyPrice: productPrices.weeklyPrice,
        stock: productPrices.stock,
      })
      .from(cartItems)
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .leftJoin(
        productPrices,
        and(
          eq(productPrices.productId, cartItems.productId),
          eq(productPrices.locationId, carts.locationId),
        ),
      )
      .where(scope);
  }

  /** The first photo of every product, in the order the photos come back. */
  function firstImageByProduct(
    rows: { productId: string; url: string; alt: string | null }[],
  ): Map<string, { url: string; alt?: string }> {
    const images = new Map<string, { url: string; alt?: string }>();

    for (const row of rows) {
      if (images.has(row.productId)) continue;

      images.set(row.productId, { url: row.url, alt: row.alt ?? undefined });
    }

    return images;
  }

  /** Builds the domain cart from its row, its lines and the city's prices. */
  function toCart(
    row: CartRowView,
    lines: CartLineView[],
    images: Map<string, { url: string; alt?: string }>,
  ): Cart {
    const items: CartItem[] = lines.map((line) => {
      const available = line.status === "active" && line.weeklyPrice !== null;

      return {
        productId: line.productId,
        name: line.name,
        slug: line.slug,
        image: images.get(line.productId),
        quantity: line.quantity,
        weeklyPrice: line.weeklyPrice ?? 0,
        deposit: line.deposit ?? undefined,
        available,
      };
    });

    const priceable = lines
      .filter((line) => line.status === "active" && line.weeklyPrice !== null)
      .map((line) => ({
        weeklyPrice: line.weeklyPrice as number,
        deposit: line.deposit ?? undefined,
        quantity: line.quantity,
      }));

    return {
      id: row.id,
      locationId: row.locationId,
      currency: row.currency,
      weeks: row.weeks,
      items,
      summary: priceCart({
        currency: row.currency,
        deliveryFee: row.deliveryFee,
        lines: priceable,
      }),
    };
  }

  /**
   * A cart with its lines and photos, in one round trip.
   *
   * The three statements do not depend on each other — each finds the cart on
   * its own — so they run as one batch. The number of statements is the same
   * whether the cart holds one line or twenty.
   */
  async function loadCart(scope: CartScope): Promise<CartRead> {
    const batch = await db
      .batch([cartRow(scope), cartLines(scope), cartImages(scope)])
      .catch(() => null);

    if (!batch) return { status: "failed" };

    const [rowRows, lineRows, imageRows] = batch;
    const [row] = rowRows;

    if (!row) return { status: "not_found" };

    return { status: "ok", cart: toCart(row, lineRows, firstImageByProduct(imageRows)) };
  }

  /**
   * The visitor's cart for one city, created on the first visit.
   *
   * A visitor has one cart per city: the city is part of the cart's identity,
   * so the prices of a Bali cart never mix with the prices of a Lisbon one.
   */
  async function getCartByOwner(
    owner: CartOwner,
    locationId: string,
  ): Promise<z.infer<(typeof getCartByOwnerResult)["schema"]>> {
    const { success, failed } = getCartByOwnerResult;

    const key = await ownerKey(owner);
    const scope = scopeByOwner(key, locationId);

    const batch = await db
      .batch([locationRow(locationId), cartRow(scope), cartLines(scope), cartImages(scope)])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [locationRows, rowRows, lineRows, imageRows] = batch;
    const [location] = locationRows;

    if (!location) return failed("location_not_found", `Location ${locationId} not found`);
    if (location.status !== "active") {
      return failed("location_not_available", `Location ${locationId} is not open yet`);
    }

    const [row] = rowRows;

    if (row) {
      return success(toCart(row, lineRows, firstImageByProduct(imageRows)));
    }

    // The first visit creates the cart. Two visits at once would both try to
    // create it, so the insert gives way to the one that came first.
    const created = await db
      .insert(carts)
      .values({
        id: crypto.randomUUID(),
        ownerType: key.ownerType,
        ownerId: key.ownerId,
        locationId,
        weeks: 1,
      })
      .onConflictDoNothing()
      .returning({ id: carts.id })
      .catch(() => null);

    if (!created) return failed("failed_to_save_cart", "Failed to save cart");

    const read = await loadCart(scope);
    if (read.status === "failed") return failed("failed_to_load_cart", "Failed to load cart");
    if (read.status === "not_found") return failed("cart_not_found", "Cart not found");

    return success(read.cart);
  }

  /**
   * One cart by id.
   *
   * The id is the key to the cart: whoever holds it can change it. It is a
   * capability, so it is unguessable and never travels in a URL the visitor
   * can be tricked into sharing.
   */
  async function getCartById(
    cartId: string,
  ): Promise<z.infer<(typeof getCartByIdResult)["schema"]>> {
    const { success, failed } = getCartByIdResult;

    const read = await loadCart(scopeById(cartId));
    if (read.status === "failed") return failed("failed_to_load_cart", "Failed to load cart");
    if (read.status === "not_found") return failed("cart_not_found", `Cart ${cartId} not found`);

    return success(read.cart);
  }

  /**
   * Puts gear in the cart, or adds to what is already there.
   *
   * The product has to be rentable in the cart's city, and the cart may not
   * hold more units of it than the city has left.
   */
  async function addItem(
    cartId: string,
    productId: string,
    quantity = 1,
  ): Promise<z.infer<(typeof addItemResult)["schema"]>> {
    const { success, failed } = addItemResult;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
      return failed(
        "invalid_quantity",
        `Quantity must be a whole number between 1 and ${maxQuantity}`,
      );
    }

    const batch = await db
      .batch([
        cartRow(scopeById(cartId)),
        cartOffer(cartId, productId),
        cartQuantity(cartId, productId),
        cartLineCount(cartId),
      ])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [rowRows, offerRows, quantityRows, countRows] = batch;
    const [row] = rowRows;

    if (!row) return failed("cart_not_found", `Cart ${cartId} not found`);

    const [offer] = offerRows;

    if (!offer) {
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${row.locationId}`,
      );
    }

    const current = quantityRows[0]?.quantity ?? 0;
    const wanted = current + quantity;

    if (wanted > maxQuantity) {
      return failed("invalid_quantity", `A cart holds at most ${maxQuantity} units of a product`);
    }
    if (offer.stock !== null && wanted > offer.stock) {
      return failed(
        "product_out_of_stock",
        `Only ${offer.stock} of ${productId} available in ${row.locationId}`,
      );
    }

    const lines = countRows[0]?.value ?? 0;

    if (current === 0 && lines >= maxLines) {
      return failed("cart_is_full", `A cart holds at most ${maxLines} kinds of gear`);
    }

    const saved = await db
      .insert(cartItems)
      .values({ cartId, productId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
      })
      .catch(() => null);

    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /**
   * Sets how many units of a product the cart holds. Zero removes the line,
   * which is also how a line that is no longer available is cleared.
   */
  async function setItemQuantity(
    cartId: string,
    productId: string,
    quantity: number,
  ): Promise<z.infer<(typeof setItemQuantityResult)["schema"]>> {
    const { success, failed } = setItemQuantityResult;

    if (!Number.isInteger(quantity) || quantity < 0 || quantity > maxQuantity) {
      return failed(
        "invalid_quantity",
        `Quantity must be a whole number between 0 and ${maxQuantity}`,
      );
    }

    const batch = await db
      .batch([
        cartRow(scopeById(cartId)),
        cartOffer(cartId, productId),
        cartQuantity(cartId, productId),
      ])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [rowRows, offerRows, quantityRows] = batch;
    const [row] = rowRows;

    if (!row) return failed("cart_not_found", `Cart ${cartId} not found`);

    const current = quantityRows[0]?.quantity ?? 0;

    if (quantity === 0) {
      if (current === 0) {
        return failed("cart_item_not_found", `Product ${productId} is not in the cart`);
      }

      const removed = await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
        .catch(() => null);

      if (!removed) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    const [offer] = offerRows;

    if (!offer) {
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${row.locationId}`,
      );
    }

    if (offer.stock !== null && quantity > offer.stock) {
      return failed(
        "product_out_of_stock",
        `Only ${offer.stock} of ${productId} available in ${row.locationId}`,
      );
    }

    const saved = await db
      .insert(cartItems)
      .values({ cartId, productId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        set: { quantity },
      })
      .catch(() => null);

    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /** Takes a product out of the cart. */
  async function removeItem(
    cartId: string,
    productId: string,
  ): Promise<z.infer<(typeof removeItemResult)["schema"]>> {
    const { success, failed } = removeItemResult;

    const batch = await db
      .batch([cartRow(scopeById(cartId)), cartQuantity(cartId, productId)])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [rowRows, quantityRows] = batch;
    const [row] = rowRows;

    if (!row) return failed("cart_not_found", `Cart ${cartId} not found`);

    const current = quantityRows[0]?.quantity ?? 0;

    if (current === 0) {
      return failed("cart_item_not_found", `Product ${productId} is not in the cart`);
    }

    const removed = await db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
      .catch(() => null);

    if (!removed) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /**
   * Sets how long the rental runs. The rent is billed weekly, so the length
   * changes how many weeks are billed, not what is due today.
   */
  async function setWeeks(
    cartId: string,
    weeks: number,
  ): Promise<z.infer<(typeof setWeeksResult)["schema"]>> {
    const { success, failed } = setWeeksResult;

    if (!Number.isInteger(weeks) || weeks < 1 || weeks > maxWeeks) {
      return failed("invalid_weeks", `Weeks must be a whole number between 1 and ${maxWeeks}`);
    }

    const saved = await db
      .update(carts)
      .set({ weeks, updatedAt: new Date() })
      .where(eq(carts.id, cartId))
      .returning({ id: carts.id })
      .catch(() => null);

    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");
    if (saved.length === 0) return failed("cart_not_found", `Cart ${cartId} not found`);

    return success();
  }

  /** Empties the cart. The cart itself stays, so it keeps its id. */
  async function clearCart(cartId: string): Promise<z.infer<(typeof clearCartResult)["schema"]>> {
    const { success, failed } = clearCartResult;

    const batch = await db
      .batch([cartRow(scopeById(cartId)), db.delete(cartItems).where(eq(cartItems.cartId, cartId))])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [rowRows] = batch;
    const [row] = rowRows;

    if (!row) return failed("cart_not_found", `Cart ${cartId} not found`);

    return success();
  }

  /**
   * The visitor's cart in the city another cart is in.
   *
   * The city is named by the other cart, so a visitor who signs in keeps the
   * basket in the city they were shopping in. The city is read as a subquery,
   * so the lookup stays one statement.
   */
  function scopeByUserInCartCity(userId: string, cartId: string): CartScope {
    return and(
      eq(carts.ownerType, "user"),
      eq(carts.ownerId, userId),
      eq(
        carts.locationId,
        db.select({ locationId: carts.locationId }).from(carts).where(eq(carts.id, cartId)),
      ),
    )!;
  }

  /**
   * Hands a guest's cart to the visitor who just signed in.
   *
   * If the visitor already has a cart in that city, the two are merged: the
   * units of the guest cart are added to the visitor's cart, up to what the
   * city has left, and the guest cart is thrown away.
   */
  async function claimCart(
    cartId: string,
    userId: string,
  ): Promise<z.infer<(typeof claimCartResult)["schema"]>> {
    const { success, failed } = claimCartResult;

    const guestScope = scopeById(cartId);
    const userScope = scopeByUserInCartCity(userId, cartId);

    const batch = await db
      .batch([
        cartRow(guestScope),
        cartRow(userScope),
        cartPricedLines(guestScope),
        cartPricedLines(userScope),
      ])
      .catch(() => null);

    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [guestRows, userRows, guestLineRows, userLineRows] = batch;
    const [guestCart] = guestRows;

    if (!guestCart) return failed("cart_not_found", `Cart ${cartId} not found`);
    if (guestCart.ownerType !== "guest") {
      return failed("cart_not_claimable", `Cart ${cartId} does not belong to a guest`);
    }

    const [userCart] = userRows;

    // The visitor has no cart in that city yet: the guest's cart simply
    // becomes theirs.
    if (!userCart) {
      const claimed = await db
        .update(carts)
        .set({ ownerType: "user", ownerId: userId, updatedAt: new Date() })
        .where(eq(carts.id, cartId))
        .catch(() => null);

      if (!claimed) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    const held = new Map(userLineRows.map((line) => [line.productId, line.quantity]));

    const merged = guestLineRows.map((line) => {
      const current = held.get(line.productId) ?? 0;
      const wanted = current + line.quantity;
      const capped = line.stock === null ? wanted : Math.min(wanted, line.stock);

      return { productId: line.productId, quantity: Math.min(capped, maxQuantity) };
    });

    // The guest cart is empty: there is nothing to move, so it just goes.
    if (merged.length === 0) {
      const dropped = await db
        .delete(carts)
        .where(eq(carts.id, cartId))
        .catch(() => null);
      if (!dropped) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    // The lines move and the guest cart goes in one transaction, so the
    // visitor's cart is never left half merged. The lines go in as one
    // statement, so the size of the guest cart does not spread the transaction
    // over one statement per line.
    const saved = await db
      .batch([
        db
          .insert(cartItems)
          .values(
            merged.map((line) => ({
              cartId: userCart.id,
              productId: line.productId,
              quantity: line.quantity,
            })),
          )
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.productId],
            set: { quantity: sql`excluded.quantity` },
          }),
        db.delete(carts).where(eq(carts.id, cartId)),
      ])
      .catch(() => null);

    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  return {
    getCartByOwner,
    getCartById,
    addItem,
    setItemQuantity,
    removeItem,
    setWeeks,
    clearCart,
    claimCart,
  };
}
