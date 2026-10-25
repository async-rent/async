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
import { enumValuesSql } from "../utils/enum";
import { billingAgreements } from "./billing";
import { rentals } from "./rental";
import { timestamps } from "./timestamps";

/**
 * Payment status values, mirroring core's `paymentStatusSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 *
 * This file imports the `billing_agreements` and `rentals` tables, so
 * `rental.ts` and `billing.ts` import these enums back and the three modules
 * form a cycle. A consumer in that cycle must not read the const while its own
 * module is being evaluated: the binding is not initialized yet. Referencing it
 * from a table's lazy config callback (the checks) is safe, and a consumer that
 * needs the column type declares it with `.$type<PaymentStatusValue>()` instead
 * of the eager `enum` option.
 */
export const paymentStatusValues = [
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "refunded",
] as const;

export type PaymentStatusValue = (typeof paymentStatusValues)[number];

/**
 * Payment provider values, mirroring core's `paymentProviderSchema`.
 *
 * Shared with `billing.ts`, which must not read it eagerly for the same reason.
 */
export const paymentProviderValues = ["paypal"] as const;

export type PaymentProviderValue = (typeof paymentProviderValues)[number];

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
 * rental's agreement. Drizzle resolves a table's extra config lazily, so the
 * object form of `foreignKey` is safe even though payment and billing import
 * each other.
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
    // Child side of the composite agreement foreign key, so enforcing the key
    // and agreement-scoped payment reads stay off a table scan.
    index("payments_billing_agreement_id_idx").on(table.billingAgreementId),
    index("payments_status_idx").on(table.status),
  ],
);

export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
