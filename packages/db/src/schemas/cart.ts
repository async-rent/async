import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { locations } from "./location";
import { products } from "./product";
import { timestamps } from "./timestamps";

/**
 * Carts being filled before checkout.
 *
 * The domain `Cart` nests its line items and its charge summary; here the lines
 * are rows in `cart_items` and the summary is flattened onto the cart row.
 * Amounts are minor units in `currency`, matching the domain's `amountSchema`.
 * `expiresAt` marks when the price snapshot stops being honoured.
 *
 * The city is stored as `locations.id`, the same key `product_prices` uses, so
 * every location reference in the schema points at a primary key.
 */
export const carts = sqliteTable(
  "carts",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id"),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    currency: text("currency").notNull(),
    weeklySubtotal: integer("weekly_subtotal").notNull().default(0),
    deposit: integer("deposit").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    totalDueToday: integer("total_due_today").notNull().default(0),
    recurringWeekly: integer("recurring_weekly").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    check(
      "carts_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("carts_weekly_subtotal_check", sql`${table.weeklySubtotal} >= 0`),
    check("carts_deposit_check", sql`${table.deposit} >= 0`),
    check("carts_delivery_fee_check", sql`${table.deliveryFee} >= 0`),
    check("carts_discount_check", sql`${table.discount} >= 0`),
    check("carts_total_due_today_check", sql`${table.totalDueToday} >= 0`),
    check("carts_recurring_weekly_check", sql`${table.recurringWeekly} >= 0`),
    index("carts_customer_id_idx").on(table.customerId),
    index("carts_location_id_idx").on(table.locationId),
    index("carts_expires_at_idx").on(table.expiresAt),
  ],
);

/** Cart line items, in display order. Prices are snapshotted when added. */
export const cartItems = sqliteTable(
  "cart_items",
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    position: integer("position").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    imageUrl: text("image_url"),
    imageAlt: text("image_alt"),
    quantity: integer("quantity").notNull().default(1),
    weeklyPrice: integer("weekly_price").notNull(),
    deposit: integer("deposit"),
  },
  (table) => [
    primaryKey({ columns: [table.cartId, table.position], name: "cart_items_pk" }),
    check("cart_items_position_check", sql`${table.position} >= 0`),
    check("cart_items_quantity_check", sql`${table.quantity} > 0`),
    check("cart_items_weekly_price_check", sql`${table.weeklyPrice} >= 0`),
    check("cart_items_deposit_check", sql`${table.deposit} is null or ${table.deposit} >= 0`),
    index("cart_items_product_id_idx").on(table.productId),
  ],
);

export type CartRow = typeof carts.$inferSelect;
export type NewCartRow = typeof carts.$inferInsert;
export type CartItemRow = typeof cartItems.$inferSelect;
export type NewCartItemRow = typeof cartItems.$inferInsert;
