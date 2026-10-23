import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateTimeSchema } from "../utils/date-time";
import { metadataSchema } from "../utils/metadata";
import { moneySchema } from "../utils/money";

/**
 * Payments and weekly billing.
 *
 * Checkout currently supports PayPal only and charges the first week today.
 * Every subsequent week is charged automatically, so a rental has both a
 * payment history and an active billing schedule.
 */

/** Supported payment providers. PayPal is the only one enabled today. */
export const paymentProviderSchema = z
  .enum(["paypal", "stripe", "xendit", "bank_transfer", "cash", "other"])
  .describe("Payment provider that processed the charge.");

/** What a payment represents. */
export const paymentKindSchema = z
  .enum(["first_week", "weekly", "deposit", "refund", "adjustment"])
  .describe("Reason for the payment.");

/** State of a single payment attempt. */
export const paymentStatusSchema = z
  .enum([
    "pending",
    "requires_action",
    "processing",
    "succeeded",
    "failed",
    "cancelled",
    "refunded",
    "partially_refunded",
  ])
  .describe("Current state of the payment attempt.");

export const paymentSchema = z
  .object({
    id: z.string().describe("Stable payment identifier."),
    rentalId: z.string().describe("Rental this payment belongs to."),
    customerId: z.string().optional().describe("Customer who paid."),
    kind: paymentKindSchema,
    provider: paymentProviderSchema,
    providerPaymentId: z
      .string()
      .optional()
      .describe("Payment id returned by the provider, e.g. a PayPal capture id."),
    providerOrderId: z
      .string()
      .optional()
      .describe("Order id returned by the provider, when different from the payment id."),
    amount: moneySchema.describe("Charged amount and currency."),
    status: paymentStatusSchema,
    failureCode: z.string().optional().describe("Provider error code when the payment failed."),
    failureMessage: z.string().optional().describe("Human-readable failure reason."),
    paidAt: dateTimeSchema.optional().describe("When the payment succeeded."),
    refundedAmount: moneySchema
      .optional()
      .describe("Amount refunded so far, when different from the original charge."),
    metadata: metadataSchema
      .optional()
      .describe("Raw provider payload or integration-specific fields."),
  })
  .extend(auditFieldsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;

/** State of a refund. */
export const refundStatusSchema = z
  .enum(["pending", "processing", "succeeded", "failed", "cancelled"])
  .describe("Current state of the refund.");

/** A refund against a specific payment. */
export const refundSchema = z
  .object({
    id: z.string().describe("Stable refund identifier."),
    paymentId: z.string().describe("Payment being refunded."),
    amount: moneySchema.describe("Refunded amount and currency."),
    status: refundStatusSchema,
    reason: z.string().optional().describe("Why the refund was issued."),
    providerRefundId: z.string().optional().describe("Refund id returned by the payment provider."),
    completedAt: dateTimeSchema.optional().describe("When the refund settled."),
  })
  .extend(auditFieldsSchema.shape);

export type Refund = z.infer<typeof refundSchema>;

/** State of the recurring weekly billing schedule. */
export const billingScheduleStatusSchema = z
  .enum(["active", "paused", "past_due", "cancelled", "completed"])
  .describe("Whether weekly charges are currently running.");

/**
 * The recurring weekly charge for a rental.
 *
 * `amount` is the weekly total after discounts. The first week is recorded as
 * a separate `Payment` with kind `first_week`; this schedule starts on week 2.
 */
export const billingScheduleSchema = z
  .object({
    id: z.string().describe("Stable billing-schedule identifier."),
    rentalId: z.string().describe("Rental being billed."),
    cycleWeeks: z.number().int().positive().describe("Billing cycle length in weeks; normally 1."),
    amount: moneySchema.describe("Amount charged every cycle."),
    nextChargeAt: dateTimeSchema.describe("When the next weekly charge is due."),
    lastChargedAt: dateTimeSchema.optional().describe("When the last successful charge happened."),
    status: billingScheduleStatusSchema,
    provider: paymentProviderSchema,
    providerSubscriptionId: z
      .string()
      .optional()
      .describe("Subscription or billing-agreement id at the provider."),
    retryCount: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Number of failed attempts for the current cycle."),
    maxRetries: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Maximum attempts before the schedule becomes past due."),
    startedAt: dateTimeSchema.optional().describe("When billing started."),
    cancelledAt: dateTimeSchema.optional().describe("When billing was cancelled."),
  })
  .extend(auditFieldsSchema.shape);

export type BillingSchedule = z.infer<typeof billingScheduleSchema>;
