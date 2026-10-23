import { z } from "zod";
import { categoryRefSchema } from "./category";
import { amountSchema } from "../utils/amount";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { dateSchema } from "../utils/date";
import { dateTimeSchema } from "../utils/date-time";
import { imageSchema } from "./media";
import { rentalPolicySchema } from "./policy";
import { taxSchema } from "./pricing";

/**
 * Product domain model for the Async storefront.
 *
 * Async rents work equipment (desks, chairs, monitors, lighting and
 * accessories) by the week. A product is therefore not only "a thing with a
 * price": it also carries rental pricing, availability, fulfillment promises
 * and the short facts rendered on catalog cards.
 *
 * Catalog prices are authored in USD. Per-location prices, availability and
 * fulfillment live on `ProductOffering`; a product keeps the base/default
 * values. Every amount of money is expressed in **minor units** together with
 * an ISO 4217 currency code, so `1200` + `"USD"` means `$12.00`.
 *
 * Schemas here are intentionally permissive — semantic and cross-field rules
 * (e.g. "a bundle must contain at least two products") belong to the outer
 * validation layer. This package only describes the shape of the domain.
 */

/* -------------------------------------------------------------------------- */
/* Shared enums & primitives                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle state of a product record.
 *
 * - `draft`     — created but not purchasable; hidden from the storefront.
 * - `active`    — visible and rentable.
 * - `archived`  — retired from the catalog; kept for historical orders.
 */
export const productStatusSchema = z
  .enum(["draft", "active", "archived"])
  .describe("Lifecycle state of the product record.");

/**
 * What the product represents in the catalog.
 *
 * - `item`   — a single rentable unit (a desk, a chair, a lamp).
 * - `bundle` — a curated set of items rented together at a discounted rate.
 */
export const productKindSchema = z
  .enum(["item", "bundle"])
  .describe("Whether the product is a single item or a curated bundle.");

/**
 * Availability of the physical fleet, independent from `status`.
 *
 * A product can be `active` in the catalog but temporarily unavailable when
 * every unit is already rented out. A product offering can override this with
 * location-specific availability.
 */
export const productAvailabilityStatusSchema = z
  .enum(["available", "low_stock", "out_of_stock", "preorder"])
  .describe("Whether units can be rented right now.");

/**
 * Visual tone used by the storefront to render a badge. The UI maps these to
 * the design-system colors; the domain does not hardcode CSS values.
 */
export const productBadgeToneSchema = z
  .enum(["primary", "neutral", "success", "warning"])
  .describe("Semantic color tone used when rendering the badge.");

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

/** Product image alias for the shared image schema. */
export const productImageSchema = imageSchema;

/**
 * All imagery attached to a product.
 */
export const productMediaSchema = z.object({
  cover: imageSchema.describe("Primary image shown on catalog cards, cart lines and bundles."),
  gallery: z
    .array(imageSchema)
    .optional()
    .describe("Additional images shown on the product detail page."),
});

export type ProductMedia = z.infer<typeof productMediaSchema>;

/* -------------------------------------------------------------------------- */
/* Marketing & descriptive content                                            */
/* -------------------------------------------------------------------------- */

/**
 * A short factual pair rendered on the product detail page, e.g.
 * `{ label: "Height range", value: "62 – 128 cm" }`.
 *
 * For the two facts on the catalog card use `highlights` instead.
 */
export const productSpecificationSchema = z.object({
  label: z.string().describe('Specification name, e.g. "Height range".'),
  value: z.string().describe('Human-readable value, e.g. "62 – 128 cm".'),
  icon: z.string().optional().describe("Optional icon key understood by the storefront UI."),
});

/**
 * A marketing badge shown over a product image, e.g. "Most rented" or "New".
 *
 * Badges are content, not behavior: the label is authored by the merchandising
 * team while `id` gives the UI a stable key.
 */
export const productBadgeSchema = z.object({
  id: z.string().describe('Stable badge key, e.g. "most_rented" or "new".'),
  label: z.string().describe('Text displayed inside the badge, e.g. "Most rented".'),
  tone: productBadgeToneSchema
    .optional()
    .describe("Color tone used by the storefront; defaults to neutral."),
});

/* -------------------------------------------------------------------------- */
/* Pricing & rental plans                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One selectable rental duration.
 *
 * The cart offers 1, 2 and 4 week commitments. Keeping plans as data (rather
 * than a hardcoded set) lets the business introduce discounted long stays
 * without a schema change.
 */
export const rentalPlanSchema = z.object({
  weeks: z.number().int().positive().describe("Rental duration in weeks, e.g. 1, 2 or 4."),
  label: z.string().optional().describe('Display label for the plan, e.g. "1 week".'),
  weekly: amountSchema.describe("Weekly rate for this plan in minor units."),
  total: amountSchema
    .optional()
    .describe(
      "Total charge for the full duration in minor units, when it differs from weekly × weeks.",
    ),
});

export type RentalPlan = z.infer<typeof rentalPlanSchema>;

/**
 * Everything needed to price a rental line.
 *
 * Prices are authored in USD. A `ProductOffering` can carry an explicit local
 * price in its location currency; when it does not, the offering is priced by
 * converting this USD price with the latest exchange rate.
 */
export const productPricingSchema = z.object({
  currency: currencyCodeSchema.describe(
    "Base catalog currency. Product prices originate in USD; location offerings may override them in the local currency.",
  ),
  weekly: amountSchema.describe("Base weekly rental price in minor units."),
  deposit: amountSchema
    .optional()
    .describe("Refundable deposit in minor units. Omit or use 0 when no deposit is required."),
  deliveryFee: amountSchema
    .optional()
    .describe("One-off delivery and setup fee in minor units. Omit or use 0 when free."),
  minimumWeeks: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Shortest commitment the customer can book, in weeks."),
  maximumWeeks: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Longest commitment the customer can book, in weeks."),
  plans: z
    .array(rentalPlanSchema)
    .optional()
    .describe("Predefined rental durations offered for this product."),
  tax: taxSchema
    .optional()
    .describe("Tax treatment applied to this price. Omit when taxes are not applicable."),
});

export type ProductPricing = z.infer<typeof productPricingSchema>;

/* -------------------------------------------------------------------------- */
/* Availability & fulfillment                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stock state of the rentable fleet.
 *
 * Counts are optional because the catalog can be rendered from a read model
 * that does not expose inventory. Date-based availability is represented by
 * `Reservation`; this object is the aggregate snapshot shown on cards.
 */
export const productAvailabilitySchema = z.object({
  status: productAvailabilityStatusSchema,
  units: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Total units owned for this product across all locations."),
  availableUnits: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Units currently free to rent."),
  restockAt: dateSchema
    .optional()
    .describe("Date when out-of-stock units are expected back, when known."),
});

export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

/**
 * The delivery promise attached to a product.
 *
 * Async delivers and assembles rentals within 24 hours in its operating
 * cities, so this data drives the "Free delivery + setup" messaging. A
 * `ProductOffering` can override the promise per location.
 */
export const productFulfillmentSchema = z.object({
  deliveryIncluded: z
    .boolean()
    .optional()
    .describe("Whether delivery is included in the weekly price."),
  setupIncluded: z
    .boolean()
    .optional()
    .describe("Whether on-site assembly and setup are included."),
  leadTimeHours: z
    .number()
    .positive()
    .optional()
    .describe("Typical delivery lead time in hours, e.g. 24."),
  locations: z
    .array(z.string())
    .optional()
    .describe('Location slugs where this product can be delivered, e.g. ["bali", "chiang-mai"].'),
});

export type ProductFulfillment = z.infer<typeof productFulfillmentSchema>;

/* -------------------------------------------------------------------------- */
/* Bundles                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A product included in a bundle.
 *
 * The embedded label lets a bundle describe an item differently from its
 * standalone name, e.g. "Task chair" instead of "Ergonomic Task Chair".
 */
export const bundleItemSchema = z.object({
  productId: z.string().describe("Identifier of the included product."),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Number of units included; defaults to 1."),
  label: z
    .string()
    .optional()
    .describe("Optional display override for the item inside the bundle."),
});

/**
 * Composition of a bundle product.
 *
 * The bundle itself still carries its own `name`, `pricing` and `media`; this
 * object only describes what is inside it. `savingsPerWeek` should be derived
 * from the component prices by the outer layer so it cannot drift.
 */
export const productBundleSchema = z.object({
  items: z.array(bundleItemSchema).describe("Products that make up the bundle."),
  savingsPerWeek: amountSchema
    .optional()
    .describe("Weekly amount saved compared with renting the items separately, in minor units."),
});

export type ProductBundle = z.infer<typeof productBundleSchema>;

/* -------------------------------------------------------------------------- */
/* Stats & SEO                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Derived catalog metrics used for sorting and badges.
 *
 * `rentalCount` powers the "Most rented" sort in the storefront. Keep this
 * optional: it is a projection that may not be present in every read model.
 */
export const productStatsSchema = z.object({
  rentalCount: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Number of completed rentals; used by the most-rented sort."),
  lastRentedAt: dateTimeSchema.optional().describe("When the product was last rented."),
  popularityScore: z.number().optional().describe("Optional blended score used for merchandising."),
});

export type ProductStats = z.infer<typeof productStatsSchema>;

/**
 * Optional metadata for search engines and social sharing.
 *
 * When a field is missing the storefront falls back to the product name and
 * description.
 */
export const productSeoSchema = z.object({
  title: z
    .string()
    .optional()
    .describe("Overrides the product name in the page title and share card."),
  description: z
    .string()
    .optional()
    .describe("Meta description used for search results and link previews."),
  keywords: z
    .array(z.string())
    .optional()
    .describe("Optional keywords for internal search and SEO tooling."),
  image: imageSchema.optional().describe("Share image; defaults to the product cover."),
});

/* -------------------------------------------------------------------------- */
/* Product base schema                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The fields every product has, independent of its category.
 *
 * Use `createProductSchema()` to add a product-specific metadata schema, and
 * `ProductOffering` to attach location-specific prices and availability.
 */
export const productBaseSchema = z
  .object({
    id: z.string().describe("Stable unique identifier for the product (UUID or database id)."),
    slug: z.string().describe('URL-safe identifier used in routes, e.g. "smartdesk-pro".'),
    sku: z
      .string()
      .optional()
      .describe("Internal stock-keeping unit used by warehouse and fulfillment tooling."),
    name: z.string().describe('Customer-facing product name, e.g. "SmartDesk Pro".'),
    brand: z.string().optional().describe('Manufacturer or brand, e.g. "Dell" or "Logitech".'),
    status: productStatusSchema,
    kind: productKindSchema,
    category: categoryRefSchema.describe("Category the product belongs to."),
    shortDescription: z
      .string()
      .optional()
      .describe("One-line description shown under the name where additional context is useful."),
    description: z
      .string()
      .optional()
      .describe("Long-form marketing copy for the product detail page."),
    highlights: z
      .array(z.string())
      .optional()
      .describe(
        'Short facts rendered on the catalog card and joined with " · ", e.g. ["Electric", "120 × 70 cm"].',
      ),
    specifications: z
      .array(productSpecificationSchema)
      .optional()
      .describe("Detailed label/value specifications for the product page."),
    media: productMediaSchema.describe("Images used to present the product."),
    pricing: productPricingSchema.describe("Base rental pricing for the product."),
    availability: productAvailabilitySchema
      .optional()
      .describe("Aggregate stock state of the physical fleet."),
    fulfillment: productFulfillmentSchema
      .optional()
      .describe("Default delivery and setup promise for this product."),
    rentalPolicy: rentalPolicySchema
      .optional()
      .describe("Default rental terms; a product offering may override them for a location."),
    badges: z
      .array(productBadgeSchema)
      .optional()
      .describe('Merchandising badges such as "Most rented" or "New".'),
    bundle: productBundleSchema
      .optional()
      .describe("Present when `kind` is `bundle`; describes the included items."),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        'Free-form labels used for search and filtering, e.g. ["standing-desk", "ergonomic"].',
      ),
    stats: productStatsSchema.optional().describe("Derived metrics such as rental count."),
    seo: productSeoSchema.optional().describe("Search and social sharing overrides."),
  })
  .extend(auditFieldsSchema.shape);

export type ProductBase = z.infer<typeof productBaseSchema>;

/**
 * Default shape of product-specific metadata: any string-keyed object.
 */
export const productMetadataSchema = z.record(z.string(), z.unknown());

/** Plain TypeScript type of the default, untyped metadata bag. */
export type ProductMetadata = z.infer<typeof productMetadataSchema>;

/**
 * Builds a product schema with category-specific, typed metadata.
 *
 * Furniture needs dimensions and materials, monitors need resolution and
 * ports, chairs need adjustability. Rather than making those fields optional on
 * one giant schema, each category defines its own metadata schema and the
 * inferred product type stays precise.
 *
 * Passing no metadata schema keeps the generic fallback and makes `metadata`
 * optional, so products without extra attributes validate too.
 *
 * Two type helpers are available:
 * - `Product<TMetadata>` — generic TypeScript type driven by the metadata type.
 * - `ProductOf<TSchema>` — infers the complete product type from a schema.
 *
 * @example
 * const deskMetadataSchema = z.object({
 *   widthCm: z.number(),
 *   depthCm: z.number(),
 *   heightRangeCm: z.tuple([z.number(), z.number()]),
 *   electric: z.boolean(),
 * });
 *
 * export const deskProductSchema = createProductSchema(deskMetadataSchema);
 * export type DeskProduct = Product<z.infer<typeof deskMetadataSchema>>;
 * // or: export type DeskProduct = ProductOf<typeof deskProductSchema>;
 * // metadata?: { widthCm: number; depthCm: number; ... }
 *
 * @example
 * // A plain product without typed metadata.
 * export const productSchema = createProductSchema();
 * export type PlainProduct = Product;
 */
export function createProductSchema<TMetadata extends z.ZodType = typeof productMetadataSchema>(
  metadata?: TMetadata,
) {
  return productBaseSchema.extend({
    metadata: ((metadata ?? productMetadataSchema) as TMetadata)
      .optional()
      .describe(
        "Product-specific attributes defined by the schema passed to createProductSchema().",
      ),
  });
}

/** Unparameterised product schema, using the default metadata bag. */
export const productSchema = createProductSchema();

/**
 * Product with an optional metadata payload.
 *
 * Use `Product<{ widthCm: number; electric: boolean }>` when the metadata type
 * is known, or leave the generic off for the default free-form metadata bag.
 */
export type Product<TMetadata = ProductMetadata> = z.infer<typeof productBaseSchema> & {
  metadata?: TMetadata;
};

/** Inferred TypeScript type of a product schema with custom metadata. */
export type ProductOf<TSchema extends z.ZodType> = z.infer<TSchema>;
