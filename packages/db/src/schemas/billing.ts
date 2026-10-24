import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumValuesSql } from "../utils/enum";
import { paymentProviderValues } from "./payment";
import { rentals } from "./rental";
import { timestamps } from "./timestamps";
/**
 * Billing agreement status values, mirroring core's `billingAgreementStatusSchema`.
 *
 * `packages/db` cannot import core's zod schemas (core depends on db), so the
 * literal union lives here and a core-side test asserts parity.
 */
export const billingAgreementStatusValues = ["active", "paused", "cancelled", "completed"] as const;

export type BillingAgreementStatusValue = (typeof billingAgreementStatusValues)[number];

/** Billing interval values, mirroring core's `billingIntervalSchema`. */
export const billingIntervalValues = ["weekly"] as const;

export type BillingIntervalValue = (typeof billingIntervalValues)[number];

/**
 * The recurring schedule that bills a rental.
 *
 * One row per rental while it keeps billing: the partial unique index below
 * allows a single live agreement (`active` or `paused`) per rental, while
 * cancelled and completed agreements stay on the row as history. The agreement
 * holds the cadence and the next charge time; each settled weekly cycle is a
 * `payments` row. Provider-specific ids stay opaque here — the payment adapter
 * in core owns their meaning.
 *
 * `rentalId` is the single authoritative edge between a rental and its
 * agreement: a rental has no denormalized pointer, so the two can never
 * disagree. The delete action is `restrict` rather than `cascade`, matching
 * `payments`: money-bearing history is never dropped silently, and a rental is
 * cancelled (`status = 'cancelled'`) rather than deleted.
 */
export const billingAgreements = sqliteTable(
  "billing_agreements",
  {
    id: text("id").primaryKey(),
    rentalId: text("rental_id")
      .notNull()
      .references(() => rentals.id, { onDelete: "restrict", onUpdate: "cascade" }),
    provider: text("provider", { enum: paymentProviderValues() }).notNull(),
    providerAgreementId: text("provider_agreement_id"),
    interval: text("interval", { enum: billingIntervalValues }).notNull().default("weekly"),
    currency: text("currency").notNull(),
    status: text("status", { enum: billingAgreementStatusValues }).notNull().default("active"),
    nextChargeAt: integer("next_charge_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    check(
      "billing_agreements_provider_check",
      sql`${table.provider} in (${enumValuesSql(paymentProviderValues())})`,
    ),
    check(
      "billing_agreements_interval_check",
      sql`${table.interval} in (${enumValuesSql(billingIntervalValues)})`,
    ),
    check(
      "billing_agreements_status_check",
      sql`${table.status} in (${enumValuesSql(billingAgreementStatusValues)})`,
    ),
    check(
      "billing_agreements_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    // One live agreement per rental; cancelled and completed ones are history.
    uniqueIndex("billing_agreements_rental_id_live_unique")
      .on(table.rentalId)
      .where(sql`${table.status} in (${enumValuesSql(["active", "paused"])})`),
    // Parent key for the composite foreign key from `payments`.
    uniqueIndex("billing_agreements_id_rental_id_unique").on(table.id, table.rentalId),
    index("billing_agreements_status_next_charge_at_idx").on(table.status, table.nextChargeAt),
  ],
);

export type BillingAgreementRow = typeof billingAgreements.$inferSelect;
export type NewBillingAgreementRow = typeof billingAgreements.$inferInsert;
