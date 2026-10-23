import { z } from "zod";
import { currencyCodeSchema } from "../utils/currency-code";
import { dateSchema } from "../utils/date";
import { productSchema } from "./product";

/**
 * Catalog read models.
 *
 * These describe the storefront's "All equipment" toolbar: a search query,
 * category/price/availability filters, the most-rented sort and the paginated
 * product grid ("Showing 12 of 25", "Load 12 more").
 *
 * This is a query model, not a persisted entity. The plain `productPageSchema`
 * uses the default product metadata bag; use `createProductPageSchema()` with
 * a category-specific product schema when the page must preserve typed
 * metadata.
 */

/** Sort options offered by the catalog toolbar. */
export const productSortSchema = z
  .enum(["most_rented", "newest", "price_asc", "price_desc", "name_asc"])
  .describe("Ordering applied to the product grid.");

export const productQuerySchema = z.object({
  q: z.string().optional().describe('Free-text search, e.g. "desks, chairs, monitors".'),
  categorySlugs: z
    .array(z.string())
    .optional()
    .describe("Restrict results to these category slugs."),
  locationId: z.string().optional().describe("Only show products offered at this location."),
  currency: currencyCodeSchema
    .optional()
    .describe("Currency used to compare and display price filters."),
  minWeeklyPrice: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Minimum weekly price in minor units, in the query currency."),
  maxWeeklyPrice: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Maximum weekly price in minor units, in the query currency."),
  availableFrom: dateSchema
    .optional()
    .describe("Only show products with inventory available from this date."),
  availableTo: dateSchema.optional().describe("Only show products available through this date."),
  sort: productSortSchema.optional(),
  page: z.number().int().positive().optional().describe("1-based page number."),
  pageSize: z.number().int().positive().optional().describe("Products per page."),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

/**
 * Builds a paginated product page while preserving the product schema's
 * metadata type.
 *
 * @example
 * export const deskPageSchema = createProductPageSchema(deskProductSchema);
 * export type DeskPage = z.infer<typeof deskPageSchema>;
 */
export function createProductPageSchema<TSchema extends z.ZodType>(product: TSchema) {
  return z.object({
    items: z.array(product).describe("Products for the current page."),
    total: z.number().int().nonnegative().describe("Total number of products matching the query."),
    page: z.number().int().positive().describe("1-based page number."),
    pageSize: z.number().int().positive().describe("Products per page."),
    hasMore: z.boolean().describe("Whether another page is available."),
  });
}

/** Plain product page using the default metadata bag. */
export const productPageSchema = createProductPageSchema(productSchema);

export type ProductPage = z.infer<typeof productPageSchema>;
