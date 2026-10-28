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
import { enumValuesSql } from "../utils/enum";
import { locations } from "./location";
import { products } from "./product";
import { timestamps } from "./timestamps";

/**
 * Cart owner types, mirroring core's `cartOwnerTypeSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const cartOwnerTypeValues = ["user", "guest"] as const;

export type CartOwnerTypeValue = (typeof cartOwnerTypeValues)[number];

/**
 * Carts being filled before checkout.
 *
 * The cart is a basket, not a quote: it holds *what* is in it and nothing
 * else. The money — the currency, the weekly prices, the deposit, the delivery
 * fee — belongs to the city, so the totals are computed from `locations` and
 * `product_prices` when the cart is read. That is why this table carries no
 * amount columns: there is no stored copy of a total that could disagree with
 * the catalog. The rental that a checkout creates is what freezes the prices.
 *
 * `owner_type` and `owner_id` say who the cart belongs to: a signed-in user
 * (their user id) or a guest (the hash of the session token in their cookie).
 * A guest never stores the token itself, only its hash.
 *
 * The city is stored as `locations.id`, the same key `product_prices` uses, so
 * every location reference in the schema points at a primary key.
 */
export const carts = sqliteTable(
  "carts",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type", { enum: cartOwnerTypeValues }).notNull(),
    ownerId: text("owner_id").notNull(),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    weeks: integer("weeks").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    check(
      "carts_owner_type_check",
      sql`${table.ownerType} in (${enumValuesSql(cartOwnerTypeValues)})`,
    ),
    check("carts_weeks_check", sql`${table.weeks} between 1 and 24`),
    // One cart per owner per city: the city is part of the cart's identity,
    // so a visitor has a basket in Bali and another in Lisbon.
    uniqueIndex("carts_owner_location_unique").on(table.ownerType, table.ownerId, table.locationId),
    // Serves the owner's cart in any city.
    index("carts_owner_idx").on(table.ownerType, table.ownerId),
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
