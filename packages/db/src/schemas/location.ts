import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamps } from "./timestamps";

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
    status: text("status", { enum: ["active", "coming_soon"] })
      .notNull()
      .default("active"),
    ...timestamps,
  },
  (table) => [
    check("locations_status_check", sql`${table.status} in ('active', 'coming_soon')`),
    index("locations_status_idx").on(table.status),
  ],
);

export type LocationRow = typeof locations.$inferSelect;
export type NewLocationRow = typeof locations.$inferInsert;
