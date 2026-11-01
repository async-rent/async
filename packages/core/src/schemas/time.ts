import { z } from "zod";

export const dateSchema = z.iso.date().describe("Calendar date in ISO 8601 format (YYYY-MM-DD).");

export const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp including a UTC offset.");

export const timeWindowSchema = z.object({
  start: z.string().describe("Window start as a local time of day (HH:MM)."),
  end: z.string().describe("Window end as a local time of day (HH:MM)."),
});

export type TimeWindow = z.infer<typeof timeWindowSchema>;

export const timestampsSchema = z.object({
  createdAt: dateTimeSchema.describe("When the record was created."),
  updatedAt: dateTimeSchema.optional().describe("When the record was last updated."),
});
