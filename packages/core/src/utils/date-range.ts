import { z } from "zod";
import { dateSchema } from "./date";

/** Inclusive range of calendar dates. */
export const dateRangeSchema = z.object({
  start: dateSchema.describe("First day of the range, inclusive."),
  end: dateSchema.describe("Last day of the range, inclusive."),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
