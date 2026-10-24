import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { billingAgreements } from "./billing";
import { paymentProviderValues, paymentStatusValues } from "./enums";
import { rentals } from "./rental";
import { timestamps } from "./timestamps";

/**
 * One charge against a rental.
 *
 * Provider-neutral: `externalOrderId` is the provider's order, and
 * `externalPaymentId` only exists once the charge settled. Each row is one
 * weekly cycle — cycle 1 is the amount captured at checkout. The unique index
 * on `(rental_id, billing_cycle)` makes a cycle settle at most once, so a
 * retried webhook cannot double-charge history.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    rentalId: text("rental_id")
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict", onUpdate: "cascade" }),
    billingAgreementId: text("billing_agreement_id").references(() => billingAgreements.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    billingCycle: integer("billing_cycle").notNull(),
    provider: text("provider", { enum: paymentProviderValues }).notNull(),
    externalOrderId: text("external_order_id").notNull(),
    externalPaymentId: text("external_payment_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: paymentStatusValues }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => [
    check("payments_billing_cycle_check", sql`${table.billingCycle} > 0`),
    check("payments_provider_check", sql`${table.provider} in ('paypal')`),
    check(
      "payments_status_check",
      sql`${table.status} in ('pending', 'authorized', 'succeeded', 'failed', 'refunded')`,
    ),
    check(
      "payments_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("payments_amount_check", sql`${table.amount} >= 0`),
    uniqueIndex("payments_rental_id_billing_cycle_unique").on(table.rentalId, table.billingCycle),
    index("payments_billing_agreement_id_idx").on(table.billingAgreementId),
    index("payments_status_idx").on(table.status),
  ],
);

export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
