import type {
  CartItemRow,
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
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Cart } from "../types";
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

/** One row of the cart query: a line, and one photo of its product. */
interface CartQueryRow {
  item: CartItemRow | null;
  product: Pick<ProductRow, "name" | "slug" | "status"> | null;
  price: ProductPriceRow | null;
  image: Pick<ProductImageRow, "url" | "alt"> | null;
}

/**
 * Builds the domain cart. A line that can no longer be rented is kept so the
 * visitor can set it to zero, but it is marked unavailable and stays out of the
 * totals.
 */
function toCart(
  location: Pick<LocationRow, "id" | "currency" | "deliveryFee">,
  rows: CartQueryRow[],
): Cart {
  const items = [
    ...groupBy(
      rows.filter(
        (
          row,
        ): row is CartQueryRow & {
          item: CartItemRow;
          product: Pick<ProductRow, "name" | "slug" | "status">;
        } => row.item !== null && row.product !== null,
      ),
      (row) => row.item.productId,
    ),
  ].map(([productId, lines]) => {
    const [line] = lines;

    return {
      productId,
      name: line.product.name,
      slug: line.product.slug,
      images: lines.flatMap(({ image }) =>
        image ? [{ url: image.url, alt: image.alt ?? undefined }] : [],
      ),
      quantity: line.item.quantity,
      weeklyPrice: line.price?.weeklyPrice ?? 0,
      deposit: line.price?.deposit ?? undefined,
      available: line.product.status === "active" && line.price !== null,
    };
  });

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
   * The visitor's cart in one city. The city is the first table of the join, so
   * a city with an empty cart still answers with one row, and a city that does
   * not exist answers with none. Nothing is written until the first item.
   */
  async function getCart(
    userId: string,
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
      .leftJoin(carts, cartScope(userId, locationId))
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

    if (first.price.stock !== null && quantity > first.price.stock) {
      return failed(
        "product_out_of_stock",
        `Only ${first.price.stock} of ${productId} available in ${locationId}`,
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
