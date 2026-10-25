import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumValuesSql } from "../utils/enum";
import { categories } from "./category";
import { locations } from "./location";
import { timestamps } from "./timestamps";

/**
 * Product status values, mirroring core's `productStatusSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const productStatusValues = ["active", "archived"] as const;

export type ProductStatusValue = (typeof productStatusValues)[number];

/**
 * Catalog products.
 *
 * The domain shape nests images, highlights, specs and per-city prices inside a
 * product; here each of those is its own table keyed by the product it belongs
 * to. The translation back into the nested domain shape happens in core.
 */
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    badge: text("badge"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: productStatusValues }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    check("products_status_check", sql`${table.status} in (${enumValuesSql(productStatusValues)})`),
    index("products_category_id_idx").on(table.categoryId),
    index("products_status_featured_idx").on(table.status, table.featured),
    index("products_name_idx").on(table.name),
  ],
);

/** Product photos, in display order. */
export const productImages = sqliteTable(
  "product_images",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    alt: text("alt"),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.position], name: "product_images_pk" }),
    check("product_images_position_check", sql`${table.position} >= 0`),
  ],
);

/** Short marketing bullets shown on product cards and pages, in order. */
export const productHighlights = sqliteTable(
  "product_highlights",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.position], name: "product_highlights_pk" }),
    check("product_highlights_position_check", sql`${table.position} >= 0`),
  ],
);

/** Label/value specification rows, in display order. */
export const productSpecs = sqliteTable(
  "product_specs",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.position], name: "product_specs_pk" }),
    check("product_specs_position_check", sql`${table.position} >= 0`),
  ],
);

/**
 * Weekly price and stock for one product in one city.
 *
 * A missing row means the product is not offered there. Amounts are minor
 * units in `currency` (USD for Bali and Chiang Mai, EUR for Lisbon), matching
 * the domain's `amountSchema`.
 */
export const productPrices = sqliteTable(
  "product_prices",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    currency: text("currency").notNull(),
    weeklyPrice: integer("weekly_price").notNull(),
    deposit: integer("deposit"),
    deliveryFee: integer("delivery_fee"),
    stock: integer("stock"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.locationId], name: "product_prices_pk" }),
    check(
      "product_prices_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("product_prices_weekly_price_check", sql`${table.weeklyPrice} >= 0`),
    check("product_prices_deposit_check", sql`${table.deposit} is null or ${table.deposit} >= 0`),
    check(
      "product_prices_delivery_fee_check",
      sql`${table.deliveryFee} is null or ${table.deliveryFee} >= 0`,
    ),
    check("product_prices_stock_check", sql`${table.stock} is null or ${table.stock} >= 0`),
    index("product_prices_location_id_idx").on(table.locationId),
  ],
);

export type ProductRow = typeof products.$inferSelect;
export type NewProductRow = typeof products.$inferInsert;
export type ProductImageRow = typeof productImages.$inferSelect;
export type NewProductImageRow = typeof productImages.$inferInsert;
export type ProductHighlightRow = typeof productHighlights.$inferSelect;
export type NewProductHighlightRow = typeof productHighlights.$inferInsert;
export type ProductSpecRow = typeof productSpecs.$inferSelect;
export type NewProductSpecRow = typeof productSpecs.$inferInsert;
export type ProductPriceRow = typeof productPrices.$inferSelect;
export type NewProductPriceRow = typeof productPrices.$inferInsert;
