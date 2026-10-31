import { z } from "zod";

export const dateSchema = z.iso.date().describe("Calendar date in ISO 8601 format (YYYY-MM-DD).");
