import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { imageSchema } from "./media";

/**
 * Catalog categories such as "Desks", "Chairs" and "Monitors".
 *
 * Categories are records rather than a hardcoded enum so new equipment types
 * can be added without changing this package. The category index on the
 * storefront also renders an image, a count and a sort order.
 */

/** Publication state of a category. */
export const categoryStatusSchema = z
  .enum(["active", "hidden", "archived"])
  .describe("Whether the category is visible in the storefront.");

export const categorySchema = z
  .object({
    id: z.string().describe("Stable category identifier."),
    slug: z.string().describe('URL-safe category key used in routes and filters, e.g. "desks".'),
    name: z.string().describe('Human-readable category name, e.g. "Desks".'),
    shortDescription: z
      .string()
      .optional()
      .describe("Optional one-line description used in category navigation."),
    description: z
      .string()
      .optional()
      .describe("Optional marketing copy shown on the category page."),
    image: imageSchema
      .optional()
      .describe("Image shown on the category card in the storefront index."),
    icon: z.string().optional().describe("Icon key understood by the storefront UI."),
    productCount: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Number of active products in this category; rendered next to the category name."),
    sortOrder: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Position of the category in the category index."),
    status: categoryStatusSchema.optional(),
  })
  .extend(auditFieldsSchema.shape);

export type Category = z.infer<typeof categorySchema>;

/**
 * The subset of a category embedded on a product. Enough to render a card or
 * a filter pill without a second lookup.
 */
export const categoryRefSchema = categorySchema.pick({
  id: true,
  slug: true,
  name: true,
});

export type CategoryRef = z.infer<typeof categoryRefSchema>;

/* Backwards-compatible aliases from the original product-only module. */
export const productCategorySchema = categorySchema;
export const productCategoryRefSchema = categoryRefSchema;
export type ProductCategory = Category;
export type ProductCategoryRef = CategoryRef;
