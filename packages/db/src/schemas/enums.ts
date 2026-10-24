/**
 * Enum values persisted as `text` columns.
 *
 * `packages/db` sits below core and cannot import its zod schemas, so the
 * literal unions are declared here and enforced with `check` constraints. A
 * core-side test asserts these stay equal to core's zod enums.
 */

/** Mirrors core's `rentalStatusSchema`. */
export const rentalStatusValues = [
  "pending_payment",
  "confirmed",
  "active",
  "completed",
  "cancelled",
] as const;

export type RentalStatusValue = (typeof rentalStatusValues)[number];

/** Mirrors core's `fulfillmentStatusSchema`. */
export const fulfillmentStatusValues = [
  "scheduled",
  "in_transit",
  "delivered",
  "returned",
] as const;

export type FulfillmentStatusValue = (typeof fulfillmentStatusValues)[number];

/** Mirrors core's `paymentStatusSchema`. */
export const paymentStatusValues = [
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "refunded",
] as const;

export type PaymentStatusValue = (typeof paymentStatusValues)[number];

/** Mirrors core's `paymentProviderSchema`. */
export const paymentProviderValues = ["paypal"] as const;

export type PaymentProviderValue = (typeof paymentProviderValues)[number];

/** Mirrors core's `billingAgreementStatusSchema`. */
export const billingAgreementStatusValues = ["active", "paused", "cancelled", "completed"] as const;

export type BillingAgreementStatusValue = (typeof billingAgreementStatusValues)[number];

/** Mirrors core's `billingIntervalSchema`. */
export const billingIntervalValues = ["weekly"] as const;

export type BillingIntervalValue = (typeof billingIntervalValues)[number];
