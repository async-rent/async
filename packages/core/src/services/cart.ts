import type { CartItemRow } from "@async-rent/db";
import {
  cartItems,
  carts,
  locations,
  productImages,
  productPrices,
  products,
} from "@async-rent/db";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { CartItem } from "../types";
import { cartSchema, priceCart } from "../types";
import { createResult, groupBy } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

/** The most units of one product a cart can hold. */
const maxQuantity = 30;

/** The most kinds of gear a cart can hold. */
const maxLines = 25;

/** A visitor has one cart per city. */
const cartScope = (userId: string, locationId: string): SQL =>
  and(eq(carts.userId, userId), eq(carts.locationId, locationId))!;

/** A stored line: what is in the cart, before the catalog fills in the rest. */
type CartLine = Pick<CartItemRow, "productId" | "quantity">;

export function createCartService({ db }: CreateCartServiceOptions) {
  const getCartResult = createResult(
    cartSchema,
    z.enum(["location_not_found", "failed_to_load_cart"]),
  );

  const putItemResult = createResult(
    z.void(),
    z.enum([
      "location_not_found",
      "location_not_available",
      "product_not_available",
      "product_out_of_stock",
      "invalid_quantity",
      "cart_is_full",
      "failed_to_load_cart",
      "failed_to_save_cart",
    ]),
  );

  const saveCartResult = createResult(
    z.void(),
    z.enum(["failed_to_load_cart", "failed_to_save_cart"]),
  );

  /** The id of the cart a scope picks out, for statements that write its lines. */
  const cartIdOf = (scope: SQL) => db.select({ id: carts.id }).from(carts).where(scope);

  /** Makes sure the visitor has a cart in the city; a visitor that has one keeps it. */
  const ensureCart = (userId: string, locationId: string) =>
    db
      .insert(carts)
      .values({ id: uuid(), userId, locationId })
      .onConflictDoUpdate({
        target: [carts.userId, carts.locationId],
        set: { updatedAt: new Date() },
      });

  /**
   * Fills the stored lines in from the catalog: the name, the photos and the
   * price the city charges today. The products, prices and photos of every
   * line are read in one batch, so a cart costs the same number of queries
   * whether it holds one line or twenty-five.
   *
   * A line whose product was archived or is no longer priced in the city is
   * kept, marked unavailable and left out of the totals, so the visitor can
   * set it to zero.
   */
  async function withDetails(locationId: string, lines: CartLine[]): Promise<CartItem[]> {
    if (lines.length === 0) return [];

    const productIds = lines.map((line) => line.productId);

    const [productRows, priceRows, imageRows] = await db.batch([
      db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          status: products.status,
        })
        .from(products)
        .where(inArray(products.id, productIds)),
      db
        .select()
        .from(productPrices)
        .where(
          and(
            inArray(productPrices.productId, productIds),
            eq(productPrices.locationId, locationId),
          ),
        ),
      db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.productId), asc(productImages.position)),
    ]);

    const productById = new Map(productRows.map((row) => [row.id, row]));
    const priceOf = new Map(priceRows.map((row) => [row.productId, row]));
    const imagesOf = groupBy(imageRows, (row) => row.productId);

    return lines.flatMap(({ productId, quantity }) => {
      const product = productById.get(productId);
      if (!product) return [];

      const price = priceOf.get(productId);

      return [
        {
          productId,
          name: product.name,
          slug: product.slug,
          images: (imagesOf.get(productId) ?? []).map((image) => ({
            url: image.url,
            alt: image.alt ?? undefined,
          })),
          quantity,
          weeklyPrice: price?.weeklyPrice ?? 0,
          deposit: price?.deposit ?? undefined,
          available: product.status === "active" && price !== undefined,
        },
      ];
    });
  }

  /**
   * The visitor's cart in one city. The city and its lines are read together,
   * then the catalog fills the lines in: two round trips, however many lines
   * the cart holds. Nothing is written until the first item.
   */
  async function getCart(
    userId: string,
    locationId: string,
  ): Promise<z.infer<(typeof getCartResult)["schema"]>> {
    const { success, failed } = getCartResult;

    const batch = await db
      .batch([
        db
          .select({
            id: locations.id,
            currency: locations.currency,
            deliveryFee: locations.deliveryFee,
          })
          .from(locations)
          .where(eq(locations.id, locationId))
          .limit(1),
        db
          .select({ productId: cartItems.productId, quantity: cartItems.quantity })
          .from(cartItems)
          .innerJoin(carts, eq(carts.id, cartItems.cartId))
          .innerJoin(products, eq(products.id, cartItems.productId))
          .where(cartScope(userId, locationId))
          .orderBy(asc(products.name)),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [[location], lines] = batch;
    if (!location) return failed("location_not_found", `Location ${locationId} not found`);

    const items = await withDetails(locationId, lines).catch(() => null);
    if (!items) return failed("failed_to_load_cart", "Failed to load cart");

    return success({
      locationId: location.id,
      currency: location.currency,
      items,
      summary: priceCart({
        currency: location.currency,
        deliveryFee: location.deliveryFee,
        lines: items.filter((item) => item.available),
      }),
    });
  }

  /**
   * Puts a product in the cart at `quantity` units, replacing what the line
   * held; zero takes the line out. The product has to be rentable in the city,
   * and the cart may not hold more units of it than the city has left, nor
   * more kinds of gear than `maxLines`.
   */
  async function putItem(
    userId: string,
    locationId: string,
    productId: string,
    quantity: number,
  ): Promise<z.infer<(typeof putItemResult)["schema"]>> {
    const { success, failed } = putItemResult;

    if (!Number.isInteger(quantity) || quantity < 0 || quantity > maxQuantity) {
      return failed(
        "invalid_quantity",
        `Quantity must be a whole number between 0 and ${maxQuantity}`,
      );
    }

    const scope = cartScope(userId, locationId);

    // Setting a line to zero is the removal: nothing to price, nothing to write.
    if (quantity === 0) {
      const removed = await db
        .delete(cartItems)
        .where(and(eq(cartItems.productId, productId), inArray(cartItems.cartId, cartIdOf(scope))))
        .catch(() => null);
      if (!removed) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    const batch = await db
      .batch([
        db
          .select({ status: locations.status })
          .from(locations)
          .where(eq(locations.id, locationId))
          .limit(1),
        db
          .select({ price: productPrices })
          .from(productPrices)
          .innerJoin(products, eq(products.id, productPrices.productId))
          .where(
            and(
              eq(productPrices.locationId, locationId),
              eq(productPrices.productId, productId),
              eq(products.status, "active"),
            ),
          )
          .limit(1),
        db
          .select({ productId: cartItems.productId })
          .from(cartItems)
          .innerJoin(carts, eq(carts.id, cartItems.cartId))
          .where(scope),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [[location], [offer], held] = batch;

    if (!location) return failed("location_not_found", `Location ${locationId} not found`);
    if (location.status !== "active") {
      return failed("location_not_available", `Location ${locationId} is not open yet`);
    }
    if (!offer) {
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${locationId}`,
      );
    }

    const line = held.find((item) => item.productId === productId);

    if (offer.price.stock !== null && quantity > offer.price.stock) {
      return failed(
        "product_out_of_stock",
        `Only ${offer.price.stock} of ${productId} available in ${locationId}`,
      );
    }
    if (!line && held.length >= maxLines) {
      return failed("cart_is_full", `A cart holds at most ${maxLines} kinds of gear`);
    }

    const saved = await db
      .batch([
        ensureCart(userId, locationId),
        db
          .insert(cartItems)
          .values({ cartId: sql`(${cartIdOf(scope)})`, productId, quantity })
          .onConflictDoUpdate({
            target: [cartItems.cartId, cartItems.productId],
            set: { quantity },
          }),
      ])
      .catch(() => null);
    if (!saved) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  /** Empties the cart. */
  async function clearCart(
    userId: string,
    locationId: string,
  ): Promise<z.infer<(typeof saveCartResult)["schema"]>> {
    const { success, failed } = saveCartResult;
    const scope = cartScope(userId, locationId);

    const cleared = await db
      .delete(cartItems)
      .where(inArray(cartItems.cartId, cartIdOf(scope)))
      .catch(() => null);
    if (!cleared) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  return {
    getCart,
    putItem,
    clearCart,
  };
}
