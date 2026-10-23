import { z } from "zod";

/** ISO 8601 calendar date, e.g. `2026-10-24`. */
export const dateSchema = z.string().describe("ISO 8601 calendar date (YYYY-MM-DD).");
