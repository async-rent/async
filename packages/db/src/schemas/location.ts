import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumValuesSql } from "../utils/enum";
import { timestamps } from "./timestamps";

/**
 * Location status values, mirroring core's `locationStatusSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const locationStatusValues = ["active", "coming_soon"] as const;

export type LocationStatusValue = (typeof locationStatusValues)[number];

/**
 * Cities Async operates in. `slug` is the URL-safe key used across the apps.
 *
 * A city owns the money of every order placed in it: `currency` is the
 * currency it quotes in and `delivery_fee` is the one-off delivery and setup
 * charge for a whole order. Both are city properties, so a cart in one city
 * can never mix currencies and never pays delivery per line.
 */
export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    timezone: text("timezone").notNull(),
    description: text("description"),
    currency: text("currency").notNull().default("USD"),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    status: text("status", { enum: locationStatusValues }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    check(
      "locations_status_check",
      sql`${table.status} in (${enumValuesSql(locationStatusValues)})`,
    ),
    check(
      "locations_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("locations_delivery_fee_check", sql`${table.deliveryFee} >= 0`),
    index("locations_status_idx").on(table.status),
  ],
);

export type LocationRow = typeof locations.$inferSelect;
export type NewLocationRow = typeof locations.$inferInsert;
