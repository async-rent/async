import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { locations } from "./location";
import { products } from "./product";
import { timestamps } from "./timestamps";

/**
 * Carts being filled before checkout.
 *
 * Only a signed-in visitor has a cart. `user_id` is the auth provider's stable
 * user id — the same id `rentals.user_id` keeps — so the cart follows the
 * person across devices. There is no local users table to point at, so the
 * column itself is the relationship.
 *
 * The cart is a basket, not a quote: it holds *what* is in it and nothing
 * else. The money — the currency, the weekly prices, the deposit, the delivery
 * fee — belongs to the city, so the totals are computed from `locations` and
 * `product_prices` when the cart is read. That is why this table carries no
 * amount columns: there is no stored copy of a total that could disagree with
 * the catalog. The rental that a checkout creates is what freezes the prices.
 *
 * The cart has no rental length: how long to rent is chosen at checkout,
 * together with the start date.
 *
 * The city is stored as `locations.id`, the same key `product_prices` uses, so
 * every location reference in the schema points at a primary key.
 */
export const carts = sqliteTable(
  "carts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    ...timestamps,
  },
  (table) => [
    // One cart per visitor per city: the city is part of the cart's identity,
    // so a visitor has a basket in Bali and another in Lisbon.
    uniqueIndex("carts_user_location_unique").on(table.userId, table.locationId),
    // Serves the visitor's cart in any city.
    index("carts_user_id_idx").on(table.userId),
  ],
);

/**
 * Cart line items.
 *
 * One row per product: the quantity is on the row, so the same product cannot
 * sit in the cart twice. Nothing is snapshotted here — the name, the photo and
 * the price are read from the catalog when the cart is read, so a cart always
 * shows what the city charges today.
 */
export const cartItems = sqliteTable(
  "cart_items",
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.cartId, table.productId], name: "cart_items_pk" }),
    check("cart_items_quantity_check", sql`${table.quantity} > 0`),
    index("cart_items_product_id_idx").on(table.productId),
  ],
);

export type CartRow = typeof carts.$inferSelect;
export type NewCartRow = typeof carts.$inferInsert;
export type CartItemRow = typeof cartItems.$inferSelect;
export type NewCartItemRow = typeof cartItems.$inferInsert;
