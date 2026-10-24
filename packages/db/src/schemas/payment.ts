import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { billingAgreements } from "./billing";
import { enumValuesSql, paymentProviderValues, paymentStatusValues } from "./enums";
import { rentals } from "./rental";
import { timestamps } from "./timestamps";

/**
 * One charge against a rental.
 *
 * Provider-neutral: `externalOrderId` is the provider's order, and
 * `externalPaymentId` only exists once the charge settled. Each row is one
 * weekly cycle — cycle 1 is the amount captured at checkout.
 *
 * The provider creates one order per charge, so the order id identifies
 * exactly one row: it is unique per provider and indexed, which is what a
 * provider callback resolves on. The capture id is unique per provider for the
 * same reason — a replayed callback must not settle a second row. The unique
 * index on `(rental_id, billing_cycle)` additionally stops a cycle from being
 * settled twice.
 *
 * The agreement is bound to the rental by a composite foreign key on
 * `(billing_agreement_id, rental_id)`, so a payment can never point at another
 * rental's agreement.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    rentalId: text("rental_id")
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict", onUpdate: "cascade" }),
    billingAgreementId: text("billing_agreement_id"),
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
    check(
      "payments_provider_check",
      sql`${table.provider} in (${enumValuesSql(paymentProviderValues)})`,
    ),
    check("payments_status_check", sql`${table.status} in (${enumValuesSql(paymentStatusValues)})`),
    check(
      "payments_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check("payments_amount_check", sql`${table.amount} >= 0`),
    foreignKey({
      name: "payments_billing_agreement_rental_fk",
      columns: [table.billingAgreementId, table.rentalId],
      foreignColumns: [billingAgreements.id, billingAgreements.rentalId],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    uniqueIndex("payments_rental_id_billing_cycle_unique").on(table.rentalId, table.billingCycle),
    uniqueIndex("payments_provider_external_order_id_unique").on(
      table.provider,
      table.externalOrderId,
    ),
    uniqueIndex("payments_provider_external_payment_id_unique").on(
      table.provider,
      table.externalPaymentId,
    ),
    index("payments_status_idx").on(table.status),
  ],
);

export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
