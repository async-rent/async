import { z } from "zod";
import { dateTimeSchema, moneySchema, timestampsSchema } from "../utils";

/**
 * PayPal payment for one week of a rental.
 *
 * The API creates a PayPal order, the buyer approves it, and the API captures
 * it. The captured charge covers the first week; the same payment carries the
 * `agreementId` that bills the following weeks weekly, and `billingCycle`
 * records which week this payment settles. `orderId` and `captureId` are the
 * ids judges can see in the sandbox dashboard; no card data ever touches Async.
 */

export const paymentStatusSchema = z.enum([
  "created",
  "approved",
  "captured",
  "failed",
  "refunded",
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentProviderSchema = z.literal("paypal");

export const paymentSchema = z
  .object({
    id: z.string().describe("Stable payment id."),
    rentalId: z.string(),
    provider: paymentProviderSchema,
    agreementId: z
      .string()
      .describe("PayPal recurring agreement id that schedules the weekly charges."),
    billingCycle: z
      .number()
      .int()
      .positive()
      .describe("Which weekly cycle this payment settles. 1 is the first week, captured today."),
    orderId: z.string().describe("PayPal order id for this cycle's charge."),
    captureId: z.string().optional().describe("PayPal capture id after a successful capture."),
    amount: moneySchema.describe("Captured amount and currency for this cycle."),
    status: paymentStatusSchema,
    paidAt: dateTimeSchema.optional(),
    nextChargeAt: dateTimeSchema
      .optional()
      .describe("When the agreement next bills, after this cycle settles."),
    failureReason: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;
