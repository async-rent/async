import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "../utils";

/**
 * Cart and checkout totals.
 *
 * A cart is single-currency: the currency belongs to the city the cart is in
 * and applies to every line and to every amount in the summary, so a cart can
 * never sum amounts of different currencies. Rentals are weekly. The first
 * week plus any deposit and delivery fee is captured today through the payment
 * provider; the following weeks are billed weekly by the billing agreement.
 *
 * There is no "recurring weekly" amount: every following week bills the
 * weekly subtotal, so the number would only ever repeat it.
 */

export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema.describe("Currency for the whole cart; every amount is in it."),
  weeklySubtotal: amountSchema.describe("Sum of weekly line prices."),
  deposit: amountSchema.default(0).describe("Refundable deposit."),
  deliveryFee: amountSchema.default(0).describe("Delivery and setup charge for the whole order."),
  discount: amountSchema.default(0).describe("Any discount applied at checkout."),
  totalDueToday: amountSchema.describe(
    "Amount captured at checkout: weeklySubtotal + deposit + deliveryFee − discount.",
  ),
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string().describe("Product name shown in the cart."),
  slug: z.string().describe("Product slug for linking back to the catalog."),
  images: z.array(imageSchema).describe("Every photo of the product, the card photo first."),
  quantity: z.number().int().positive(),
  weeklyPrice: amountSchema.describe("Weekly price in the cart's currency."),
  deposit: amountSchema.optional().describe("Refundable deposit per unit in the cart's currency."),
  available: z
    .boolean()
    .describe(
      "False when the product is no longer offered in the cart's city. Such a " +
        "line can still be set to zero, but it is not priced and not part of the totals.",
    ),
});

export type CartItem = z.infer<typeof cartItemSchema>;

/**
 * What a signed-in visitor has picked in one city.
 *
 * A cart has no id: it is found by its visitor and the city. It holds what is
 * in it and nothing more — prices are the city's, read when the cart is read,
 * so the cart always shows what the city charges today. How long to rent is
 * chosen at checkout.
 */
export const cartSchema = z.object({
  locationId: z.string().describe("Stable location id this cart is for."),
  currency: currencyCodeSchema.describe("Currency the cart's city quotes in."),
  items: z.array(cartItemSchema),
  summary: chargeSummarySchema,
});

export type Cart = z.infer<typeof cartSchema>;

/**
 * One priced line of a cart.
 *
 * The prices are the city's, read when the cart is read: a cart never stores
 * a price of its own, so it always shows what the city charges today.
 */
export interface PriceableLine {
  weeklyPrice: number;
  deposit?: number;
  quantity: number;
}

/**
 * The money of a cart.
 *
 * The weekly subtotal and the deposit are per unit; the delivery fee is the
 * city's, charged once for the whole order. Only the first week is due today
 * — the following weeks are billed weekly by the billing agreement, so the
 * length of the rental does not change what is captured at checkout.
 */
export function priceCart(input: {
  currency: string;
  deliveryFee: number;
  discount?: number;
  lines: PriceableLine[];
}): ChargeSummary {
  const weeklySubtotal = input.lines.reduce(
    (sum, line) => sum + line.weeklyPrice * line.quantity,
    0,
  );
  const deposit = input.lines.reduce((sum, line) => sum + (line.deposit ?? 0) * line.quantity, 0);
  const deliveryFee = input.lines.length > 0 ? input.deliveryFee : 0;
  const discount = input.discount ?? 0;

  return {
    currency: input.currency,
    weeklySubtotal,
    deposit,
    deliveryFee,
    discount,
    totalDueToday: weeklySubtotal + deposit + deliveryFee - discount,
  };
}
