import { z } from "zod";

/** Percentage value from 0 to 100. */
export const percentageSchema = z
  .number()
  .min(0)
  .max(100)
  .describe("Percentage value between 0 and 100.");
