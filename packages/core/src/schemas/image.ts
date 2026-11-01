import { z } from "zod";

export const imageSchema = z.object({
  url: z.string().describe("Absolute URL of the image file."),
  alt: z.string().optional().describe("Alternative text for screen readers."),
});

export type Image = z.infer<typeof imageSchema>;
