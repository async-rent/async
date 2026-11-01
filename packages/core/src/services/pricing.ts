import { z } from "zod";
import type { ChargeSummary } from "../schemas";
import { amountSchema, currencyCodeSchema } from "../schemas";

/**
 * The pricing service holds the pure money logic the cart and rental services
 * share. It takes no database: the same input always yields the same summary,
 * so the composition root injects it into the services that need it and also
 * exposes it on `async` for an app that wants to preview a total without a
 * round trip.
 */

/** One priceable line: a per-unit weekly price and deposit, and how many units. */
export const priceableLineSchema = z.object({
  weeklyPrice: amountSchema.describe("Rental price per week for one unit."),
  deposit: amountSchema.optional().describe("Refundable deposit charged once per unit."),
  quantity: z.number().int().positive().describe("Units of this line."),
});

export type PriceableLine = z.infer<typeof priceableLineSchema>;

/** Input to `priceLines`: the lines to price and the order-level fee and discount. */
export const priceLinesInputSchema = z.object({
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  discount: amountSchema.optional(),
  lines: z
    .array(priceableLineSchema)
    .describe("Lines to price; an empty list means nothing is owed yet."),
});

export type PriceLinesInput = z.infer<typeof priceLinesInputSchema>;

/** A line to summarize: priced per unit, and marked available or not. */
export const summarizableLineSchema = priceableLineSchema.extend({
  available: z
    .boolean()
    .describe("Whether the line can be rented now; unavailable lines are not priced."),
});

export type SummarizableLine = z.infer<typeof summarizableLineSchema>;

/** Input to `summarizeCharge`: lines that may be available or not. */
export const summarizeChargeInputSchema = z.object({
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  discount: amountSchema.optional(),
  lines: z.array(summarizableLineSchema),
});

export type SummarizeChargeInput = z.infer<typeof summarizeChargeInputSchema>;

/**
 * Prices a set of lines into a charge summary. Pure: the same lines always
 * produce the same totals.
 *
 * Delivery is an order-level fee, charged once and only when there is at least
 * one line to price. The deposit and weekly price are per unit, so both scale
 * with quantity. The discount, when given, comes off the total due today.
 */
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

/**
 * Totals a set of lines, pricing only the ones that are still available. Pure:
 * an unavailable line (a product the city no longer rents, or one that went out
 * of stock) is dropped before pricing, so it never adds to the total.
 */
export function summarizeCharge(input: SummarizeChargeInput): ChargeSummary {
  return priceLines({
    currency: input.currency,
    deliveryFee: input.deliveryFee,
    discount: input.discount,
    lines: input.lines
      .filter((line) => line.available)
      .map((line) => ({
        weeklyPrice: line.weeklyPrice,
        deposit: line.deposit,
        quantity: line.quantity,
      })),
  });
}

/**
 * Creates the pricing service. Takes no dependencies because every method is
 * pure; it exists so the composition root can inject one pricing surface into
 * the cart and rental services and expose it on `async.pricing`.
 */
export function createPricingService() {
  return {
    priceLines,
    summarizeCharge,
  };
}

export type PricingService = ReturnType<typeof createPricingService>;
