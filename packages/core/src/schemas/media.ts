import { z } from "zod";

/**
 * Image media shared by products, categories and delivery records.
 *
 * The storefront uses neutral studio shots on catalog cards and lifestyle
 * shots on detail pages; both use the same shape.
 */
export const imageSchema = z.object({
  url: z.string().describe("Image source URL."),
  alt: z.string().optional().describe("Accessible description of what the image shows."),
  width: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Intrinsic image width in pixels, when known."),
  height: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Intrinsic image height in pixels, when known."),
  blurHash: z.string().optional().describe("Tiny placeholder hash rendered while the image loads."),
});

export type Image = z.infer<typeof imageSchema>;

/** Ordered list of images. */
export const imageGallerySchema = z.array(imageSchema);
