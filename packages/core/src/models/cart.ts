import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "./shared";
import type { ProductStatus } from "./catalog";
import { chargeSummarySchema, priceLines, type ChargeSummary } from "./pricing";

export const maxCartLineQuantity = 30;
export const maxCartLines = 25;

export const cartLineQuantitySchema = z.number().int().min(0).max(maxCartLineQuantity);

export const cartLineErrorValues = [
  "invalid_quantity",
  "product_out_of_stock",
  "cart_is_full",
] as const;

export const cartLineErrorSchema = z.enum(cartLineErrorValues);

export type CartLineError = z.infer<typeof cartLineErrorSchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  images: z.array(imageSchema),
  quantity: z.number().int().positive(),
  weeklyPrice: amountSchema,
  deposit: amountSchema.optional(),
  available: z.boolean(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  locationId: z.string(),
  currency: currencyCodeSchema,
  items: z.array(cartItemSchema),
  summary: chargeSummarySchema,
});

export type Cart = z.infer<typeof cartSchema>;

export const cartLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

export type CartLine = z.infer<typeof cartLineSchema>;

export const summarizeCartInputSchema = z.object({
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  items: z.array(cartItemSchema),
});

export type SummarizeCartInput = z.infer<typeof summarizeCartInputSchema>;

export function summarizeCart(input: SummarizeCartInput): ChargeSummary {
  return priceLines({
    currency: input.currency,
    deliveryFee: input.deliveryFee,
    lines: input.items.filter((item) => item.available),
  });
}

export function cartQuantityError(quantity: number): "invalid_quantity" | null {
  return cartLineQuantitySchema.safeParse(quantity).success ? null : "invalid_quantity";
}

export const cartLineErrorInputSchema = z.object({
  lines: z.array(cartLineSchema),
  productId: z.string(),
  quantity: cartLineQuantitySchema,
  stock: z.number().int().nonnegative().nullable(),
});

export type CartLineErrorInput = z.infer<typeof cartLineErrorInputSchema>;

export function cartLineError(input: CartLineErrorInput): CartLineError | null {
  const quantityError = cartQuantityError(input.quantity);
  if (quantityError) return quantityError;
  if (input.quantity === 0) return null;

  if (input.stock != null && input.quantity > input.stock) return "product_out_of_stock";

  const lineExists = input.lines.some((line) => line.productId === input.productId);
  if (!lineExists && input.lines.length >= maxCartLines) return "cart_is_full";

  return null;
}

export function isCartItemAvailable(status: ProductStatus, hasPrice: boolean): boolean {
  return status === "active" && hasPrice;
}
