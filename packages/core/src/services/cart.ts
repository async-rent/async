import {
  cartItems,
  carts,
  locations,
  productImages,
  productPrices,
  products,
} from "@async-rent/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Cart, CartItem, CartLine, CartLineError } from "../models";
import {
  cartLineError,
  cartLineErrorValues,
  cartLineQuantitySchema,
  cartQuantityError,
  cartSchema,
  isCartItemAvailable,
  isLocationActive,
  maxCartLineQuantity,
  maxCartLines,
  summarizeCart,
} from "../models";
import { createResult, groupBy } from "../utils";

export interface CreateCartServiceOptions {
  db: DrizzleD1Database;
}

export const getCartByIdInputSchema = z.object({
  cartId: z.string().describe("Cart identifier."),
});

export type GetCartByIdInput = z.infer<typeof getCartByIdInputSchema>;

export const getCartByUserAndLocationInputSchema = z.object({
  userId: z.string().describe("Signed-in user who owns the cart."),
  locationId: z.string().describe("Location the cart is scoped to; prices come from here."),
});

export type GetCartByUserAndLocationInput = z.infer<typeof getCartByUserAndLocationInputSchema>;

export const putItemInputSchema = z.object({
  cartId: z.string().describe("Cart identifier."),
  productId: z.string().describe("Product to add to the cart."),
  quantity: cartLineQuantitySchema,
});

export type PutItemInput = z.infer<typeof putItemInputSchema>;

export const clearCartInputSchema = z.object({
  cartId: z.string().describe("Cart identifier."),
});

export type ClearCartInput = z.infer<typeof clearCartInputSchema>;

function lineErrorMessage(
  error: CartLineError,
  input: { productId: string; locationId: string; stock: number | null },
): string {
  if (error === "product_out_of_stock") {
    return `Only ${input.stock} of ${input.productId} available in ${input.locationId}`;
  }
  if (error === "cart_is_full") {
    return `A cart holds at most ${maxCartLines} kinds of gear`;
  }

  return `Quantity must be a whole number between 0 and ${maxCartLineQuantity}`;
}

const getCartByIdResult = createResult(
  cartSchema,
  z.enum(["cart_not_found", "failed_to_load_cart"]),
);

export const getCartByIdResultSchema = getCartByIdResult.schema;
export type GetCartByIdResult = z.infer<typeof getCartByIdResultSchema>;

const getCartByUserAndLocationResult = createResult(
  cartSchema,
  z.enum(["location_not_found", "failed_to_load_cart", "failed_to_save_cart"]),
);

export const getCartByUserAndLocationResultSchema = getCartByUserAndLocationResult.schema;
export type GetCartByUserAndLocationResult = z.infer<typeof getCartByUserAndLocationResultSchema>;

const putItemErrorValues = [
  "cart_not_found",
  "location_not_available",
  "product_not_available",
  ...cartLineErrorValues,
  "failed_to_load_cart",
  "failed_to_save_cart",
] as const;

const putItemResult = createResult(z.void(), z.enum(putItemErrorValues));

export const putItemResultSchema = putItemResult.schema;
export type PutItemResult = z.infer<typeof putItemResultSchema>;

const clearCartResult = createResult(z.void(), z.enum(["failed_to_save_cart"]));

export const clearCartResultSchema = clearCartResult.schema;
export type ClearCartResult = z.infer<typeof clearCartResultSchema>;

export function createCartService({ db }: CreateCartServiceOptions) {
  const cartById = (cartId: string) =>
    db
      .select({
        id: carts.id,
        userId: carts.userId,
        locationId: carts.locationId,
        currency: locations.currency,
        deliveryFee: locations.deliveryFee,
      })
      .from(carts)
      .innerJoin(locations, eq(locations.id, carts.locationId))
      .where(eq(carts.id, cartId))
      .limit(1);

  const cartByScope = ({ userId, locationId }: GetCartByUserAndLocationInput) =>
    db
      .select({
        id: carts.id,
        userId: carts.userId,
        locationId: carts.locationId,
        currency: locations.currency,
        deliveryFee: locations.deliveryFee,
      })
      .from(carts)
      .innerJoin(locations, eq(locations.id, carts.locationId))
      .where(and(eq(carts.userId, userId), eq(carts.locationId, locationId)))
      .limit(1);

  const linesOf = (cartId: string) =>
    db
      .select({ productId: cartItems.productId, quantity: cartItems.quantity })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(asc(products.name));

  const linesByScope = ({ userId, locationId }: GetCartByUserAndLocationInput) =>
    db
      .select({ productId: cartItems.productId, quantity: cartItems.quantity })
      .from(cartItems)
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(and(eq(carts.userId, userId), eq(carts.locationId, locationId)))
      .orderBy(asc(products.name));

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
          available: isCartItemAvailable(product.status, price !== undefined),
        },
      ];
    });
  }

  function toCart(
    cart: {
      id: string;
      userId: string;
      locationId: string;
      currency: string;
      deliveryFee: number;
    },
    items: CartItem[],
  ): Cart {
    return {
      id: cart.id,
      userId: cart.userId,
      locationId: cart.locationId,
      currency: cart.currency,
      items,
      summary: summarizeCart({
        currency: cart.currency,
        deliveryFee: cart.deliveryFee,
        items,
      }),
    };
  }

  async function getCartById(input: GetCartByIdInput): Promise<GetCartByIdResult> {
    const { success, failed } = getCartByIdResult;

    const batch = await db.batch([cartById(input.cartId), linesOf(input.cartId)]).catch(() => null);
    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [[cart], lines] = batch;
    if (!cart) return failed("cart_not_found", `Cart ${input.cartId} not found`);

    const items = await withDetails(cart.locationId, lines).catch(() => null);
    if (!items) return failed("failed_to_load_cart", "Failed to load cart");

    return success(toCart(cart, items));
  }

  async function getCartByUserAndLocation(
    input: GetCartByUserAndLocationInput,
  ): Promise<GetCartByUserAndLocationResult> {
    const { userId, locationId } = input;
    const { success, failed } = getCartByUserAndLocationResult;

    const batch = await db
      .batch([
        db
          .select({ currency: locations.currency, deliveryFee: locations.deliveryFee })
          .from(locations)
          .where(eq(locations.id, locationId))
          .limit(1),
        cartByScope(input),
        linesByScope(input),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [[location], [cart], lines] = batch;
    if (!location) return failed("location_not_found", `Location ${locationId} not found`);

    if (cart) {
      const items = await withDetails(cart.locationId, lines).catch(() => null);
      if (!items) return failed("failed_to_load_cart", "Failed to load cart");

      return success(toCart(cart, items));
    }

    const created = await db
      .insert(carts)
      .values({ id: uuid(), userId, locationId })
      .onConflictDoUpdate({
        target: [carts.userId, carts.locationId],
        set: { updatedAt: new Date() },
      })
      .returning({ id: carts.id })
      .catch(() => null);
    if (!created) return failed("failed_to_save_cart", "Failed to save cart");

    const [createdCart] = created;
    if (!createdCart) return failed("failed_to_save_cart", "Failed to save cart");

    return success({
      id: createdCart.id,
      userId,
      locationId,
      currency: location.currency,
      items: [],
      summary: summarizeCart({
        currency: location.currency,
        deliveryFee: location.deliveryFee,
        items: [],
      }),
    });
  }

  async function putItem(input: PutItemInput): Promise<PutItemResult> {
    const { cartId, productId, quantity } = input;
    const { success, failed } = putItemResult;

    const quantityError = cartQuantityError(quantity);
    if (quantityError) {
      return failed(
        quantityError,
        `Quantity must be a whole number between 0 and ${maxCartLineQuantity}`,
      );
    }

    // Zero removes the line: nothing to price, nothing to write.
    if (quantity === 0) {
      const removed = await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
        .catch(() => null);
      if (!removed) return failed("failed_to_save_cart", "Failed to save cart");

      return success();
    }

    const batch = await db
      .batch([
        db
          .select({
            id: carts.id,
            locationId: carts.locationId,
            status: locations.status,
          })
          .from(carts)
          .innerJoin(locations, eq(locations.id, carts.locationId))
          .where(eq(carts.id, cartId))
          .limit(1),
        db
          .select({ price: productPrices })
          .from(productPrices)
          .innerJoin(carts, eq(carts.locationId, productPrices.locationId))
          .innerJoin(products, eq(products.id, productPrices.productId))
          .where(
            and(
              eq(carts.id, cartId),
              eq(productPrices.productId, productId),
              eq(products.status, "active"),
            ),
          )
          .limit(1),
        db
          .select({ productId: cartItems.productId, quantity: cartItems.quantity })
          .from(cartItems)
          .where(eq(cartItems.cartId, cartId)),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_load_cart", "Failed to load cart");

    const [[cart], [offer], held] = batch;

    if (!cart) return failed("cart_not_found", `Cart ${cartId} not found`);
    if (!isLocationActive(cart)) {
      return failed("location_not_available", `Location ${cart.locationId} is not open yet`);
    }
    if (!offer) {
      return failed(
        "product_not_available",
        `Product ${productId} is not available in ${cart.locationId}`,
      );
    }

    const lineError = cartLineError({
      lines: held,
      productId,
      quantity,
      stock: offer.price.stock,
    });

    if (lineError) {
      return failed(
        lineError,
        lineErrorMessage(lineError, {
          productId,
          locationId: cart.locationId,
          stock: offer.price.stock,
        }),
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

  async function clearCart(input: ClearCartInput): Promise<ClearCartResult> {
    const { success, failed } = clearCartResult;

    const cleared = await db
      .delete(cartItems)
      .where(eq(cartItems.cartId, input.cartId))
      .catch(() => null);
    if (!cleared) return failed("failed_to_save_cart", "Failed to save cart");

    return success();
  }

  return {
    getCartById,
    getCartByUserAndLocation,
    putItem,
    clearCart,
  };
}
