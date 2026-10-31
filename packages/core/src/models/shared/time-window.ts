import { z } from "zod";

export const timeWindowSchema = z.object({
  start: z.string().describe("Window start as a local time of day (HH:MM)."),
  end: z.string().describe("Window end as a local time of day (HH:MM)."),
});

export type TimeWindow = z.infer<typeof timeWindowSchema>;
