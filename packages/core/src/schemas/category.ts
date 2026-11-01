import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type Category = z.infer<typeof categorySchema>;
