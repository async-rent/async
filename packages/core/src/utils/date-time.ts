import { z } from "zod";

/** ISO 8601 timestamp with timezone, e.g. `2026-10-24T09:30:00+08:00`. */
export const dateTimeSchema = z
  .string()
  .describe("ISO 8601 timestamp with timezone offset, e.g. 2026-10-24T09:30:00+08:00.");
