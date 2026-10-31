import { z } from "zod";

export const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp including a UTC offset.");
