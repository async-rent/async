import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumValuesSql } from "../utils/enum";
import { paymentStatusValues } from "./payment";
import type { PaymentStatusValue } from "./payment";
import { locations } from "./location";
import { products } from "./product";
import { timestamps } from "./timestamps";

/**
 * Rental status values, mirroring core's `rentalStatusSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const rentalStatusValues = [
  "pending_payment",
  "confirmed",
  "active",
  "completed",
  "cancelled",
] as const;

export type RentalStatusValue = (typeof rentalStatusValues)[number];

/** Fulfillment status values, mirroring core's `fulfillmentStatusSchema`. */
export const fulfillmentStatusValues = [
  "scheduled",
  "in_transit",
  "delivered",
  "returned",
] as const;

export type FulfillmentStatusValue = (typeof fulfillmentStatusValues)[number];

/**
 * A placed rental: the order, its delivery snapshot and its money.
 *
 * Contact, address and line prices are copied onto the rows at checkout so
 * later catalog edits never rewrite history. Dates are ISO calendar dates
 * (`YYYY-MM-DD`) and delivery window bounds are local `HH:MM` strings, matching
 * the domain schemas.
 *
 * The recurring agreement is not denormalized here: `billing_agreements.rental_id`
 * is the single authoritative edge, and it is unique per live agreement, so a
 * rental has at most one agreement that still bills. Core reads it from there
 * when it fills the domain's `billingAgreementId`.
 *
 * The city is stored as `locations.id`, the same key `product_prices` uses, so
 * every location reference in the schema points at a primary key.
 */
export const rentals = sqliteTable(
  "rentals",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    userId: text("user_id"),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactWhatsapp: text("contact_whatsapp"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    addressArea: text("address_area"),
    addressCity: text("address_city").notNull(),
    addressPostcode: text("address_postcode"),
    addressCountryCode: text("address_country_code").notNull(),
    deliveryNotes: text("delivery_notes"),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "restrict", onUpdate: "cascade" }),
    currency: text("currency").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    deliveryDate: text("delivery_date"),
    deliveryWindowStart: text("delivery_window_start"),
    deliveryWindowEnd: text("delivery_window_end"),
    status: text("status", { enum: rentalStatusValues }).notNull().default("pending_payment"),
    fulfillmentStatus: text("fulfillment_status", { enum: fulfillmentStatusValues }),
    weeklySubtotal: integer("weekly_subtotal").notNull().default(0),
    deposit: integer("deposit").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    totalDueToday: integer("total_due_today").notNull().default(0),
    paymentStatusSnapshot: text("payment_status_snapshot").$type<PaymentStatusValue>(),
    termsAcceptedAt: integer("terms_accepted_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    check("rentals_status_check", sql`${table.status} in (${enumValuesSql(rentalStatusValues)})`),
    check(
      "rentals_fulfillment_status_check",
      sql`${table.fulfillmentStatus} is null or ${table.fulfillmentStatus} in (${enumValuesSql(fulfillmentStatusValues)})`,
    ),
    check(
      "rentals_payment_status_snapshot_check",
      sql`${table.paymentStatusSnapshot} is null or ${table.paymentStatusSnapshot} in (${enumValuesSql(paymentStatusValues)})`,
    ),
    check(
      "rentals_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("rentals_weekly_subtotal_check", sql`${table.weeklySubtotal} >= 0`),
    check("rentals_deposit_check", sql`${table.deposit} >= 0`),
    check("rentals_delivery_fee_check", sql`${table.deliveryFee} >= 0`),
    check("rentals_discount_check", sql`${table.discount} >= 0`),
    check("rentals_total_due_today_check", sql`${table.totalDueToday} >= 0`),
    index("rentals_user_id_idx").on(table.userId),
    index("rentals_location_id_idx").on(table.locationId),
    index("rentals_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

/** Rental line items, in display order. Prices are snapshotted at checkout. */
export const rentalItems = sqliteTable(
  "rental_items",
  {
    rentalId: text("rental_id")
      .notNull()
      .references(() => rentals.id, { onDelete: "cascade", onUpdate: "cascade" }),
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
    primaryKey({ columns: [table.rentalId, table.position], name: "rental_items_pk" }),
    check("rental_items_position_check", sql`${table.position} >= 0`),
    check("rental_items_quantity_check", sql`${table.quantity} > 0`),
    check("rental_items_weekly_price_check", sql`${table.weeklyPrice} >= 0`),
    check("rental_items_deposit_check", sql`${table.deposit} is null or ${table.deposit} >= 0`),
    index("rental_items_product_id_idx").on(table.productId),
  ],
);

export type RentalRow = typeof rentals.$inferSelect;
export type NewRentalRow = typeof rentals.$inferInsert;
export type RentalItemRow = typeof rentalItems.$inferSelect;
export type NewRentalItemRow = typeof rentalItems.$inferInsert;
