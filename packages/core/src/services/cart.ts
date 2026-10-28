import type {
  CartItemRow,
  CartRow,
  LocationRow,
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
} from "@async-rent/db";
import {
  cartItems,
  carts,
  locations,
  productImages,
  productPrices,
  products,
} from "@async-rent/db";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Cart, CartItem, CartOwner } from "../types";
import { cartSchema, priceCart } from "../types";
import { createResult } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

/** The most units of one product a cart can hold. */
const maxQuantity = 30;

/** The most kinds of gear a cart can hold. */
const maxLines = 25;

/**
 * The most lines one insert carries. D1 binds at most 100 parameters in a
 * statement and a merged line binds five — three for the cart lookup plus the
 * product and the quantity — so the move is split below that ceiling.
 */
const linesPerInsert = 19;

/** How a change moves a line: an add is relative, a set assigns a number. */
type QuantityChange = { kind: "add"; units: number } | { kind: "set"; quantity: number };

/** The units a line holds once `change` is applied to `current`. */
function quantityAfter(current: number, change: QuantityChange): number {
  return change.kind === "add" ? current + change.units : change.quantity;
}

/** Splits lines into inserts small enough for D1 to bind. */
function inInsertSizedChunks<T>(items: T[]): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += linesPerInsert) {
    chunks.push(items.slice(index, index + linesPerInsert));
  }

  return chunks;
}

const inRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

type OwnerKey = Pick<CartRow, "ownerType" | "ownerId">;

/**
 * The two columns a cart keeps its owner in. A guest is stored by the hash of
 * their token, never the token itself, so a leaked database gives away no
 * live session.
 */
function ownerKey(owner: CartOwner): OwnerKey {
  if (owner.kind === "user") return { ownerType: "user", ownerId: owner.userId };

  return { ownerType: "guest", ownerId: bytesToHex(sha256(utf8ToBytes(owner.token))) };
}

/** A visitor has one cart per city. */
function cartScope(key: OwnerKey, locationId: string): SQL {
  return and(
    eq(carts.ownerType, key.ownerType),
    eq(carts.ownerId, key.ownerId),
    eq(carts.locationId, locationId),
  )!;
}

/** One row of the cart query: a line, and one photo of its product. */
interface CartQueryRow {
  item: CartItemRow | null;
  product: Pick<ProductRow, "name" | "slug" | "status"> | null;
  price: ProductPriceRow | null;
  image: Pick<ProductImageRow, "url" | "alt"> | null;
}

/**
 * Builds the domain cart. A line that can no longer be rented is kept so the
 * visitor can remove it, but it is marked unavailable and stays out of the
 * totals.
 */
function toCart(
  location: Pick<LocationRow, "id" | "currency" | "deliveryFee">,
  rows: CartQueryRow[],
): Cart {
  const lines = rows.reduce((lines, { item, product, price, image }) => {
    if (!item || !product) return lines;

    const line = lines.get(item.productId) ?? {
      productId: item.productId,
      name: product.name,
      slug: product.slug,
      images: [],
      quantity: item.quantity,
      weeklyPrice: price?.weeklyPrice ?? 0,
      deposit: price?.deposit ?? undefined,
      available: product.status === "active" && price !== null,
    };

    if (image) line.images.push({ url: image.url, alt: image.alt ?? undefined });

    return lines.set(item.productId, line);
  }, new Map<string, CartItem>());

  const items = [...lines.values()];

  return {
    locationId: location.id,
    currency: location.currency,
    items,
    summary: priceCart({
      currency: location.currency,
      deliveryFee: location.deliveryFee,
      lines: items.filter((item) => item.available),
    }),
  };
}

/**
 * Adds the guest's units to the ones the visitor already holds, up to what the
 * city has left. A line with nothing left to give is dropped.
 */
function mergeLines(
  guestLines: (Pick<CartItemRow, "productId" | "quantity"> & Pick<ProductPriceRow, "stock">)[],
  userLines: Pick<CartItemRow, "productId" | "quantity">[],
): Pick<CartItemRow, "productId" | "quantity">[] {
  const held = new Map(userLines.map((line) => [line.productId, line.quantity]));

  return guestLines
    .map((line) => ({
      productId: line.productId,
      quantity: Math.min(
        (held.get(line.productId) ?? 0) + line.quantity,
        line.stock ?? Infinity,
        maxQuantity,
      ),
    }))
    .filter((line) => line.quantity > 0);
}

export function createCartService({ db }: CreateCartServiceOptions) {
  const getCartResult = createResult(
    cartSchema,
    z.enum(["location_not_found", "failed_to_load_cart"]),
  );

  const changeItemResult = createResult(
    z.void(),
    z.enum([
      "location_not_found",
      "location_not_available",
      "product_not_available",
      "product_out_of_stock",
      "invalid_quantity",
      "cart_is_full",
      "cart_item_not_found",
      "failed_to_load_cart",
      "failed_to_save_cart",
    ]),
  );

  const saveCartResult = createResult(
    z.void(),
    z.enum(["failed_to_load_cart", "failed_to_save_cart"]),
  );

  /** The id of the cart a scope picks out, for statements that write its lines. */
  function cartIdOf(scope: SQL) {
    return db.select({ id: carts.id }).from(carts).where(scope);
  }

  /** Makes sure the owner has a cart in the city; an owner that has one keeps it. */
  function ensureCart(key: OwnerKey, locationId: string) {
    return db
      .insert(carts)
      .values({ id: uuid(), ...key, locationId })
      .onConflictDoUpdate({
        target: [carts.ownerType, carts.ownerId, carts.locationId],
        set: { updatedAt: new Date() },
      });
  }

  /**
   * The owner's cart in one city. The city is the first table of the join, so
   * a city with an empty cart still answers with one row, and a city that does
   * not exist answers with none. Nothing is written until the first item.
   */
  async function getCart(
    owner: CartOwner,
    locationId: string,
  ): Promise<z.infer<(typeof getCartResult)["schema"]>> {
    const { success, failed } = getCartResult;

    const rows = await db
      .select({
        location: {
          id: locations.id,
          currency: locations.currency,
          deliveryFee: locations.deliveryFee,
        },
        item: cartItems,
        product: { name: products.name, slug: products.slug, status: products.status },
        price: productPrices,
        image: { url: productImages.url, alt: productImages.alt },
      })
      .from(locations)
      .leftJoin(carts, cartScope(ownerKey(owner), locationId))
      .leftJoin(cartItems, eq(cartItems.cartId, carts.id))
      .leftJoin(products, eq(products.id, cartItems.productId))
      .leftJoin(
        productPrices,
        and(eq(productPrices.productId, products.id), eq(productPrices.locationId, locations.id)),
      )
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .where(eq(locations.id, locationId))
      .orderBy(asc(products.name), asc(productImages.position))
      .catch(() => null);
    if (!rows) return failed("failed_to_load_cart", "Failed to load cart");

    const [first] = rows;
    if (!first) return failed("location_not_found", `Location ${locationId} not found`);

    return success(toCart(first.location, rows));
  }

  /**
   * Puts a product in the cart, moving its line by `change`. An add is written
   * as a relative increment, so two adds that overlap both land; a set assigns
   * the number the visitor picked, and needs the line to be there already. The
   * product has to be rentable in the city, and the cart may not hold more
   * units of it than the city has left.
   */
  async function putItem(
    owner: CartOwner,
    locationId: string,
    productId: string,
    change: QuantityChange,
  ): Promise<z.infer<(typeof changeItemResult)["schema"]>> {
    const { success, failed } = changeItemResult;
    const key = ownerKey(owner);
    const scope = cartScope(key, locationId);

    const rows = await db
      .select({
        status: locations.status,
        product: { id: products.id },
        price: productPrices,
        item: cartItems,
      })
      .from(locations)
      .leftJoin(
        productPrices,
        and(eq(productPrices.locationId, locations.id), eq(productPrices.productId, productId)),
      )
      .leftJoin(
        products,
        and(eq(products.id, productPrices.productId), eq(products.status, "active")),
      )
      .leftJoin(carts, scope)
      .leftJoin(cartItems, eq(cartItems.cartId, carts.id))
      .where(eq(locations.id, locationId))
      .catch(() => null);
    if (!rows) return failed("failed_to_load_cart", "Failed to load cart");

    const [first] = rows;
    if (!first) return failed("location_not_found", `Location ${locationId} not found`);
    if (first.status !== "active") {
      return failed("location_not_available", `Location ${locationId} is not open yet`);
    }
    if (!first.product || !first.price) {
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${locationId}`,
      );
    }

    const held = rows.flatMap((row) => (row.item ? [row.item] : []));
    const line = held.find((item) => item.productId === productId);
    if (change.kind === "set" && !line) {
      return failed("cart_item_not_found", `Product ${productId} is not in the cart`);
    }
    const quantity = quantityAfter(line?.quantity ?? 0, change);

    if (quantity > maxQuantity) {
      return failed("invalid_quantity", `A cart holds at most ${maxQuantity} units of a product`);
    }
    if (first.price.stock !== null && quantity > first.price.stock) {
      return failed(
        "product_out_of_stock",
        `Only ${first.price.stock} of ${productId} available in ${locationId}`,
      );
    }
    if (!line && held.length >= maxLines) {
      return failed("cart_is_full", `A cart holds at most ${maxLines} kinds of gear`);
    }

    // An add on a new line starts at its units; an add on an existing line is
    // the increment the conflict branch writes, never the stale total.
    const inserted = change.kind === "add" ? change.units : change.quantity;
    const saved = await db
      .batch([
        ensureCart(key, locationId),
        db
          .insert(cartItems)
          .values({ cartId: sql`(${cartIdOf(scope)})`, productId, quantity: inserted })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.productId],
            set:
              change.kind === "add"
                ? { quantity: sql`${cartItems.quantity} + ${change.units}` }
                : { quantity: change.quantity },
          }),
      ])
      .catch(() => null);
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /** Adds units of a product to the cart, on top of what is already there. */
  async function addItem(
    owner: CartOwner,
    locationId: string,
    productId: string,
    quantity = 1,
  ): Promise<z.infer<(typeof changeItemResult)["schema"]>> {
    const { failed } = changeItemResult;

    if (!inRange(quantity, 1, maxQuantity)) {
      return failed(
        "invalid_quantity",
        `Quantity must be a whole number between 1 and ${maxQuantity}`,
      );
    }

    return putItem(owner, locationId, productId, { kind: "add", units: quantity });
  }

  /**
   * Sets how many units of a product the cart holds. The product has to be in
   * the cart already; zero removes the line.
   */
  async function setItemQuantity(
    owner: CartOwner,
    locationId: string,
    productId: string,
    quantity: number,
  ): Promise<z.infer<(typeof changeItemResult)["schema"]>> {
    const { failed } = changeItemResult;

    if (!inRange(quantity, 0, maxQuantity)) {
      return failed(
        "invalid_quantity",
        `Quantity must be a whole number between 0 and ${maxQuantity}`,
      );
    }
    if (quantity === 0) return removeItem(owner, locationId, productId);

    return putItem(owner, locationId, productId, { kind: "set", quantity });
  }

  /** Takes a product out of the cart. Removing what is not there changes nothing. */
  async function removeItem(
    owner: CartOwner,
    locationId: string,
    productId: string,
  ): Promise<z.infer<(typeof saveCartResult)["schema"]>> {
    const { success, failed } = saveCartResult;
    const scope = cartScope(ownerKey(owner), locationId);

    const removed = await db
      .delete(cartItems)
      .where(and(eq(cartItems.productId, productId), inArray(cartItems.cartId, cartIdOf(scope))))
      .catch(() => null);
    if (!removed) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /** Empties the cart. */
  async function clearCart(
    owner: CartOwner,
    locationId: string,
  ): Promise<z.infer<(typeof saveCartResult)["schema"]>> {
    const { success, failed } = saveCartResult;
    const scope = cartScope(ownerKey(owner), locationId);

    const cleared = await db
      .delete(cartItems)
      .where(inArray(cartItems.cartId, cartIdOf(scope)))
      .catch(() => null);
    if (!cleared) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /**
   * Moves a guest's cart into the cart of the visitor who just signed in.
   * Units the visitor already holds are added to, up to what the city has
   * left, and the guest's cart is thrown away.
   */
  async function mergeCart(
    token: string,
    userId: string,
    locationId: string,
  ): Promise<z.infer<(typeof saveCartResult)["schema"]>> {
    const { success, failed } = saveCartResult;
    const userKey = ownerKey({ kind: "user", userId });
    const guestScope = cartScope(ownerKey({ kind: "guest", token }), locationId);
    const userScope = cartScope(userKey, locationId);

    const lines = await db
      .select({
        ownerType: carts.ownerType,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
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
      .where(or(guestScope, userScope))
      .catch(() => null);
    if (!lines) return failed("failed_to_load_cart", "Failed to load cart");

    const merged = mergeLines(
      lines.filter((line) => line.ownerType === "guest"),
      lines.filter((line) => line.ownerType === "user"),
    );

    // Nothing to move: the guest's cart just goes.
    if (merged.length === 0) {
      const dropped = await db
        .delete(carts)
        .where(guestScope)
        .catch(() => null);
      if (!dropped) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    // The lines move and the guest's cart goes in one transaction, so the
    // visitor's cart is never left half merged. A full guest cart is more
    // lines than one insert can bind, so the move is split into a few.
    const saved = await db
      .batch([
        ensureCart(userKey, locationId),
        ...inInsertSizedChunks(merged).map((lines) =>
          db
            .insert(cartItems)
            .values(lines.map((line) => ({ cartId: sql`(${cartIdOf(userScope)})`, ...line })))
            .onConflictDoUpdate({
              target: [cartItems.cartId, cartItems.productId],
              set: { quantity: sql`excluded.quantity` },
            }),
        ),
        db.delete(carts).where(guestScope),
      ])
      .catch(() => null);
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  return {
    getCart,
    addItem,
    setItemQuantity,
    removeItem,
    clearCart,
    mergeCart,
  };
}
