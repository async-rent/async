import { z } from "zod";

/** ISO 4217 currency code. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe("ISO 4217 currency code, e.g. USD.");
