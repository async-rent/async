import { z } from "zod";

export const amountSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Integer amount in the currency's minor unit, e.g. cents.");

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .describe("ISO 4217 three-letter currency code, e.g. USD.");
