import { z } from "zod";
import {
  amountSchema,
  currencyCodeSchema,
  imageSchema,
  paginationSchema,
  timestampsSchema,
} from "../utils";

/**
 * Catalog: the cities Async operates in and the gear available there.
 *
 * Storefront and MCP read from these same shapes. Prices are weekly and set
 * independently per location, so Bali and Lisbon can differ. Each price row
 * quotes a single `currency` (USD today); the three amounts in the row are
 * minor units in that currency.
 */

export const locationStatusSchema = z.enum(["active", "coming_soon"]);

export const locationSchema = z.object({
  id: z.string().describe("Stable location id."),
  slug: z.string().describe('URL-safe key used in routes, e.g. "bali".'),
  name: z.string().describe('Display name, e.g. "Bali".'),
  country: z.string().describe('Country name, e.g. "Indonesia".'),
  timezone: z.string().describe('IANA timezone, e.g. "Asia/Makassar".'),
  description: z.string().optional().describe("One-line description for the city picker."),
  currency: currencyCodeSchema.describe("Currency every price in this city is quoted in."),
  deliveryFee: amountSchema.describe(
    "One-off delivery and setup charge for an order in this city.",
  ),
  status: locationStatusSchema.default("active"),
});

export type Location = z.infer<typeof locationSchema>;

export const categorySchema = z.object({
  id: z.string().describe("Stable category id."),
  slug: z.string().describe('URL-safe key, e.g. "desks".'),
  name: z.string().describe('Display name, e.g. "Desks".'),
  description: z.string().optional().describe("One-line category description."),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type Category = z.infer<typeof categorySchema>;

/**
 * A product's price and stock in one city.
 *
 * The presence of a row means the product is offered there. Omitting a city
 * means the product is not available in that location.
 *
 * The currency and the delivery fee belong to the city, not to the product:
 * every price in a city is in that city's currency, and an order pays delivery
 * once no matter how many products it holds.
 */
export const productPriceSchema = z.object({
  locationId: z.string().describe("Stable location id this price applies to."),
  weeklyPrice: amountSchema.describe("Weekly rental price in this city."),
  deposit: amountSchema.optional().describe("Refundable deposit in this city."),
  stock: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Units available in this city. Omit for unlimited."),
});

export type ProductPrice = z.infer<typeof productPriceSchema>;

export const productStatusSchema = z.enum(["active", "archived"]);

export const productSpecSchema = z.object({
  label: z.string().describe('Specification name, e.g. "Height range".'),
  value: z.string().describe('Human-readable value, e.g. "62–128 cm".'),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productSchema = z
  .object({
    id: z.string().describe("Stable product id."),
    slug: z.string().describe('URL-safe key used in routes, e.g. "smartdesk-pro".'),
    name: z.string().describe('Customer-facing name, e.g. "SmartDesk Pro".'),
    tagline: z.string().describe("One-line description shown on catalog cards."),
    description: z.string().describe("Long-form copy for the product page."),
    categoryId: z.string().describe("Stable category id this product related to."),
    images: z.array(imageSchema).min(1),
    prices: z
      .array(productPriceSchema)
      .min(1)
      .describe("Per-city prices. A city missing from this list cannot rent the product."),
    highlights: z.array(z.string()).default([]),
    specs: z.array(productSpecSchema).default([]),
    badge: z.string().optional().describe('Merchandising label, e.g. "Most rented".'),
    featured: z.boolean().default(false),
    status: productStatusSchema.default("active"),
  })
  .extend(timestampsSchema.shape);

export type Product = z.infer<typeof productSchema>;

export const productSortSchema = z.enum([
  "featured",
  "price_asc",
  "price_desc",
  "name_asc",
  "newest",
]);

export type ProductSort = z.infer<typeof productSortSchema>;

/**
 * Words a free-text search may carry. The service folds and counts tokens the
 * same way, and rejects a `q` beyond this cap with `invalid_product_query`.
 */
export const maxSearchTokens = 8;

export const productQuerySchema = z.object({
  q: z
    .string()
    .max(120)
    .refine(
      (q) =>
        q
          .trim()
          .split(/\s+/)
          .filter((token) => token.length > 0).length <= maxSearchTokens,
    )
    .optional()
    .describe('Free-text search, e.g. "desk".'),
  categoryId: z
    .string()
    .optional()
    .describe("Stable category id to filter by; the edge resolves a slug to it."),
  locationId: z
    .string()
    .optional()
    .describe("Stable location id to filter by; the edge resolves a slug to it."),
  sort: productSortSchema.default("featured"),
  page: z.number().int().positive().max(100).default(1),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(48)
    .default(12)
    .describe(
      "Products per page. The cap also keeps each batched child-table select — one bound " +
        "parameter per product id — well under D1's 100 bound-parameter statement limit.",
    ),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export const productPageSchema = paginationSchema(productSchema);

export type ProductPage = z.infer<typeof productPageSchema>;

/** Resolve a product's price in one city. */
export function priceForLocation(product: Product, locationId: string) {
  return product.prices.find((price) => price.locationId === locationId);
}
