import { sql } from "drizzle-orm";
import { check, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { timestamps } from "./timestamps";

/** Gear categories used by the catalog filters and category pages. */
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [check("categories_sort_order_check", sql`${table.sortOrder} >= 0`)],
);

export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
