import { z } from "zod";

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe("ISO 4217 three-letter currency code, e.g. USD.");
