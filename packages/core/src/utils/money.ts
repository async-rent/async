import { z } from "zod";
import { amountSchema } from "./amount";
import { currencyCodeSchema } from "./currency-code";

/** A monetary value with its currency. */
export const moneySchema = z.object({
  amount: amountSchema.describe("Amount in minor units."),
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;
