import { z } from "zod";

/** ISO 8601 calendar date. */
export const dateSchema = z.iso.date().describe("Calendar date in YYYY-MM-DD format.");
