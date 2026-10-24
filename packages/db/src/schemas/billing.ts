import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  billingAgreementStatusValues,
  billingIntervalValues,
  paymentProviderValues,
} from "./enums";
import { rentals } from "./rental";
import { timestamps } from "./timestamps";

/**
 * The recurring schedule that bills a rental.
 *
 * One row per rental while it keeps billing. The agreement holds the cadence
 * and the next charge time; each settled weekly cycle is a `payments` row.
 * Provider-specific ids stay opaque here — the payment adapter in core owns
 * their meaning.
 */
export const billingAgreements = sqliteTable(
  "billing_agreements",
  {
    id: text("id").primaryKey(),
    rentalId: text("rental_id")
      .notNull()
      .references(() => rentals.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: text("provider", { enum: paymentProviderValues }).notNull(),
    providerAgreementId: text("provider_agreement_id"),
    interval: text("interval", { enum: billingIntervalValues }).notNull().default("weekly"),
    currency: text("currency").notNull(),
    status: text("status", { enum: billingAgreementStatusValues }).notNull().default("active"),
    nextChargeAt: integer("next_charge_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    check("billing_agreements_provider_check", sql`${table.provider} in ('paypal')`),
    check("billing_agreements_interval_check", sql`${table.interval} in ('weekly')`),
    check(
      "billing_agreements_status_check",
      sql`${table.status} in ('active', 'paused', 'cancelled', 'completed')`,
    ),
    check(
      "billing_agreements_currency_check",
      sql`length(${table.currency}) = 3 and ${table.currency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    index("billing_agreements_rental_id_idx").on(table.rentalId),
    index("billing_agreements_status_next_charge_at_idx").on(table.status, table.nextChargeAt),
  ],
);

export type BillingAgreementRow = typeof billingAgreements.$inferSelect;
export type NewBillingAgreementRow = typeof billingAgreements.$inferInsert;
