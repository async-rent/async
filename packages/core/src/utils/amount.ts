import { z } from "zod";

/** Amount in the smallest currency unit, e.g. `12000` = $120.00. */
export const amountSchema = z
  .number()
  .int()
  .nonnegative()
  .describe("Amount in the smallest currency unit, e.g. 12000 = $120.00.");
