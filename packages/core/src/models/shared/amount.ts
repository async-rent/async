import { z } from "zod";

export const amountSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Integer amount in the currency's minor unit, e.g. cents.");
