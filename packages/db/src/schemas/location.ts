import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumValuesSql } from "../utils/enum";
import { timestamps } from "./timestamps";

/**
 * Location status values, mirroring core's `locationSchema` status enum.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const locationStatusValues = ["active", "coming_soon"] as const;

export type LocationStatusValue = (typeof locationStatusValues)[number];

/** Cities Async operates in. `slug` is the URL-safe key used across the apps. */
export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    timezone: text("timezone").notNull(),
    description: text("description"),
    status: text("status", { enum: locationStatusValues }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    check(
      "locations_status_check",
      sql`${table.status} in (${enumValuesSql(locationStatusValues)})`,
    ),
    index("locations_status_idx").on(table.status),
  ],
);

export type LocationRow = typeof locations.$inferSelect;
export type NewLocationRow = typeof locations.$inferInsert;
