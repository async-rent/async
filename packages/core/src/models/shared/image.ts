import { z } from "zod";

export const imageSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
});

export type Image = z.infer<typeof imageSchema>;
