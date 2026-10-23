import { z } from "zod";
import { dateTimeSchema } from "./date-time";

/** Timestamps appended to persisted records. */
export const timestampsSchema = z.object({
  createdAt: dateTimeSchema.optional().describe("When the record was created."),
  updatedAt: dateTimeSchema.optional().describe("When the record was last updated."),
});
