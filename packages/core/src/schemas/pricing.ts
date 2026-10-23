import { z } from "zod";
import { amountSchema } from "../utils/amount";
import { currencyCodeSchema } from "../utils/currency-code";

/**
 * Tax rules and rental charge summaries.
 *
 * Prices in the catalog are authored in USD. A location offering may override
 * them in the local currency and attach the tax treatment that applies there
 * (for example PB1 in Bali).
 */

/** How tax applies to a price. */
export const taxSchema = z.object({
  inclusive: z.boolean().describe("Whether the listed price already includes this tax."),
  rate: z.number().nonnegative().describe("Tax rate as a fraction, e.g. 0.11 for 11%."),
  label: z.string().optional().describe('Display label, e.g. "VAT" or "PB1".'),
  countryCode: z.string().optional().describe("ISO country code the tax rule applies to."),
});

export type Tax = z.infer<typeof taxSchema>;

/**
 * The money summary rendered in the cart and checkout.
 *
 * `dueToday` is the amount charged at checkout (first week + deposit +
 * delivery − discount + tax), while `recurringWeekly` is what gets charged
 * every week after that.
 */
export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema.describe("Currency shared by every amount in this summary."),
  weeklySubtotal: amountSchema.describe("Sum of weekly line prices before discounts and tax."),
  deliveryFee: amountSchema.describe("Delivery and setup charge for this order."),
  deposit: amountSchema.describe("Refundable deposit for this order."),
  discount: amountSchema.optional().describe("Total discount applied to this order."),
  tax: amountSchema
    .optional()
    .describe("Tax amount when prices are tax-exclusive; omit when tax-inclusive."),
  dueToday: amountSchema.describe(
    "Amount charged at checkout: first week + deposit + delivery − discount + tax.",
  ),
  recurringWeekly: amountSchema
    .optional()
    .describe("Amount charged every week after the first week."),
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;
