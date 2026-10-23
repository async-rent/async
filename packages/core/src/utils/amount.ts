import { z } from "zod";

/** Amount in minor units, e.g. `1200` = $12.00. */
export const amountSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Amount in the smallest currency unit (e.g. cents). Must be an integer.");
