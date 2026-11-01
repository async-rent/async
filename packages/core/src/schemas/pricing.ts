import { z } from "zod";
import { amountSchema, currencyCodeSchema } from "./money";

/**
 * The agreed charges of a cart or rental, frozen at checkout.
 *
 * This lives in `schemas` because it is a stored field of the cart and rental
 * entities, not an operation's input. The pricing service owns the inputs that
 * produce it.
 */
export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema,
  weeklySubtotal: amountSchema.describe("Sum of weekly prices for the priced lines."),
  deposit: amountSchema
    .default(0)
    .describe("Refundable deposit charged once, on top of the weekly subtotal."),
  deliveryFee: amountSchema
    .default(0)
    .describe("Delivery fee, waived when there are no priced lines."),
  discount: amountSchema.default(0).describe("Amount deducted from the total."),
  totalDueToday: amountSchema.describe(
    "Weekly subtotal plus deposit and delivery, minus discount.",
  ),
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;
