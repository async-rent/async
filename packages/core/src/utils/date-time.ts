import { z } from "zod";

/** ISO 8601 timestamp with timezone. */
export const dateTimeSchema = z.string().describe("ISO 8601 timestamp, e.g. 2026-10-24T09:30:00Z.");
