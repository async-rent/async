import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema, moneySchema } from "../utils";

/**
 * Cart and checkout totals.
 *
 * Rentals are weekly. The first week plus any deposit and delivery fee is
 * captured today through PayPal; the following weeks are billed weekly.
 */

export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema,
  weeklySubtotal: amountSchema.describe("Sum of weekly line prices."),
  deposit: amountSchema.default(0).describe("Refundable deposit."),
  deliveryFee: amountSchema.default(0).describe("Delivery and setup charge."),
  discount: amountSchema.default(0).describe("Any discount applied at checkout."),
  totalDueToday: amountSchema.describe(
    "Amount captured by PayPal: weeklySubtotal + deposit + deliveryFee − discount.",
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
  weeklyPrice: moneySchema,
  deposit: moneySchema.optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().describe("Stable cart id."),
  customerId: z.string().optional().describe("Clerk user id, when signed in."),
  locationSlug: z.string(),
  items: z.array(cartItemSchema).min(1),
  summary: chargeSummarySchema,
  expiresAt: z.string().optional().describe("When the price snapshot expires."),
});

export type Cart = z.infer<typeof cartSchema>;
