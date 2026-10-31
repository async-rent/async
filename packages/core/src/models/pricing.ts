import { z } from "zod";
import { amountSchema, currencyCodeSchema } from "./shared";

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

export const priceableLineSchema = z.object({
  weeklyPrice: amountSchema.describe("Rental price per week for one unit."),
  deposit: amountSchema.optional().describe("Refundable deposit charged once per unit."),
  quantity: z.number().int().positive().describe("Units of this line."),
});

export type PriceableLine = z.infer<typeof priceableLineSchema>;

export const priceLinesInputSchema = z.object({
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  discount: amountSchema.optional(),
  lines: z
    .array(priceableLineSchema)
    .describe("Lines to price; an empty list means nothing is owed yet."),
});

export type PriceLinesInput = z.infer<typeof priceLinesInputSchema>;

export function priceLines(input: PriceLinesInput): ChargeSummary {
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
