import { z } from "zod";
import { dateTimeSchema } from "./date-time";

/** Fields appended to persisted records. */
export const auditFieldsSchema = z.object({
  createdAt: dateTimeSchema.optional().describe("When the record was created."),
  updatedAt: dateTimeSchema.optional().describe("When the record was last updated."),
});

export type AuditFields = z.infer<typeof auditFieldsSchema>;
