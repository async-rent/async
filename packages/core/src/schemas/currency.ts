import { z } from "zod";
import { currencyCodeSchema } from "../utils/currency-code";
import { dateTimeSchema } from "../utils/date-time";

/**
 * Currency and foreign-exchange model.
 *
 * Async authors catalog prices in USD. Each location has its own local
 * currency, and a product offering may either:
 *
 * 1. provide an explicit local price (`productOffering.pricing`), or
 * 2. fall back to converting the product's USD price with the latest
 *    `exchangeRate` whose `quoteCurrency` matches the location currency.
 *
 * Resolving which path to use is outer-layer logic; this module only describes
 * the data. Converted amounts should be rounded to the target currency's
 * smallest unit (see `currencySchema.decimals`).
 */

/** Async's single base currency. */
export const BASE_CURRENCY = "USD" as const;

/** Literal schema for the base currency. */
export const baseCurrencySchema = z
  .literal(BASE_CURRENCY)
  .describe("Async's base currency. Every catalog price originates in USD.");

/** A supported currency. */
export const currencySchema = z.object({
  code: currencyCodeSchema,
  name: z.string().optional().describe('Display name, e.g. "US Dollar".'),
  symbol: z.string().optional().describe('Display symbol, e.g. "$" or "Rp".'),
  decimals: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of decimal places used when formatting the currency."),
  isBase: z
    .boolean()
    .optional()
    .describe("Whether this is Async's base currency; only USD should be true."),
});

export type Currency = z.infer<typeof currencySchema>;

/**
 * A USD → local-currency conversion rate.
 *
 * `rate` is expressed as how many units of `quoteCurrency` equal one USD.
 * Keep one current row per quote currency; historical rows let past rentals
 * reproduce the rate they were priced with.
 */
export const exchangeRateSchema = z.object({
  baseCurrency: baseCurrencySchema,
  quoteCurrency: currencyCodeSchema.describe("Currency being converted to."),
  rate: z.number().positive().describe("How many units of quoteCurrency equal one USD."),
  asOf: dateTimeSchema.describe("When this rate was captured."),
  source: z
    .string()
    .optional()
    .describe('Where the rate came from, e.g. "openexchangerates" or "manual".'),
  effectiveFrom: dateTimeSchema
    .optional()
    .describe("Start of the period this rate should be used for."),
  effectiveTo: dateTimeSchema
    .optional()
    .describe("End of the period this rate should be used for."),
});

export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
