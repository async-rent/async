import { z } from "zod";
import { dateTimeSchema } from "./date-time";

export const timestampsSchema = z.object({
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema.optional(),
});
