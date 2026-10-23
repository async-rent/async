import { z } from "zod";

/** An image shown on catalog cards, product pages and cart lines. */
export const imageSchema = z.object({
  url: z.string().describe("Image URL."),
  alt: z.string().optional().describe("Alternative text for accessibility."),
});

export type Image = z.infer<typeof imageSchema>;
