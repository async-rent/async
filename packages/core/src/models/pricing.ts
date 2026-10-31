import { z } from "zod";
import { amountSchema, currencyCodeSchema } from "./shared";

export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema,
  weeklySubtotal: amountSchema,
  deposit: amountSchema.default(0),
  deliveryFee: amountSchema.default(0),
  discount: amountSchema.default(0),
  totalDueToday: amountSchema,
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;

export const priceableLineSchema = z.object({
  weeklyPrice: amountSchema,
  deposit: amountSchema.optional(),
  quantity: z.number().int().positive(),
});

export type PriceableLine = z.infer<typeof priceableLineSchema>;

export const priceLinesInputSchema = z.object({
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  discount: amountSchema.optional(),
  lines: z.array(priceableLineSchema),
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
