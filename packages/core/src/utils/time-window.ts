import { z } from "zod";

/** Local time-of-day range used for delivery windows. */
export const timeWindowSchema = z.object({
  start: z.string().describe('Local start time, e.g. "10:00".'),
  end: z.string().describe('Local end time, e.g. "12:00".'),
});

export type TimeWindow = z.infer<typeof timeWindowSchema>;
