import { z } from "zod";

/** ISO 8601 timestamp with a timezone (`Z` or a `±HH:MM` offset). */
export const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp, e.g. 2026-10-24T09:30:00Z.");
