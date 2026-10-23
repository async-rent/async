import { z } from "zod";

/** ISO 4217 currency code. */
export const currencyCodeSchema = z.string().describe("ISO 4217 currency code, e.g. USD or IDR.");
