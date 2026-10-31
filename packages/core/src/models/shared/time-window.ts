import { z } from "zod";

export const timeWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export type TimeWindow = z.infer<typeof timeWindowSchema>;
