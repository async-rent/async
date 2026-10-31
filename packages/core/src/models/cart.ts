import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "./shared";
import type { ProductStatus } from "./catalog";
import { chargeSummarySchema, priceLines, type ChargeSummary } from "./pricing";

export const maxCartLineQuantity = 30;
export const maxCartLines = 25;

export const cartLineQuantitySchema = z
  .number()
  .int()
  .min(0)
  .max(maxCartLineQuantity)
  .describe(`Units of one product in the cart; 0 removes the line (max ${maxCartLineQuantity}).`);

export const cartLineErrorValues = [
  "invalid_quantity",
  "product_out_of_stock",
  "cart_is_full",
] as const;

export const cartLineErrorSchema = z
  .enum(cartLineErrorValues)
  .describe("Why a cart line cannot be written.");

export type CartLineError = z.infer<typeof cartLineErrorSchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  images: z.array(imageSchema),
  quantity: z.number().int().positive().describe("Units of this product in the cart."),
  weeklyPrice: amountSchema.describe("Rental price per week at the cart's location."),
  deposit: amountSchema.optional().describe("Refundable deposit charged once at checkout."),
  available: z
    .boolean()
    .describe("Whether the product can be rented right now; unavailable items are not priced."),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  locationId: z.string().describe("Location the cart is scoped to; prices come from here."),
  currency: currencyCodeSchema,
  items: z.array(cartItemSchema),
  summary: chargeSummarySchema.describe("Totals calculated from the available items."),
});

export type Cart = z.infer<typeof cartSchema>;

export const cartLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().describe("Units of this product already held in the cart."),
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
  stock: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Units available at the cart's location; null when stock is not tracked."),
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
