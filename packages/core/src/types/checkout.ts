import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "../utils";

/**
 * Cart and checkout totals.
 *
 * A cart is single-currency: `summary.currency` applies to every line and to
 * every amount in the summary, so a cart can never sum amounts of different
 * currencies. Rentals are weekly. The first week plus any deposit and delivery
 * fee is captured today through the payment provider; the following weeks are
 * billed weekly by the billing agreement.
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
  recurringWeekly: amountSchema.describe("Amount charged every week after the first week."),
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string().describe("Product name snapshot shown in the cart."),
  slug: z.string().describe("Product slug for linking back to the catalog."),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1),
  weeklyPrice: amountSchema.describe("Weekly price in the cart's currency."),
  deposit: amountSchema.optional().describe("Refundable deposit in the cart's currency."),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().describe("Stable cart id."),
  customerId: z.string().optional().describe("Stable user id, when signed in."),
  locationId: z.string().describe("Stable location id this cart is for."),
  items: z.array(cartItemSchema).min(1),
  summary: chargeSummarySchema,
  expiresAt: z.string().optional().describe("When the price snapshot expires."),
});

export type Cart = z.infer<typeof cartSchema>;
