import { z } from "zod";
import { dateTimeSchema, moneySchema, timestampsSchema } from "../utils";

/**
 * PayPal payment for the first month.
 *
 * The API creates a PayPal order, the buyer approves it, and the API captures
 * it. `orderId` and `captureId` are the ids judges can see in the sandbox
 * dashboard; no card data ever touches Async.
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
    orderId: z.string().describe("PayPal order id."),
    captureId: z.string().optional().describe("PayPal capture id after a successful capture."),
    amount: moneySchema.describe("Captured amount and currency."),
    status: paymentStatusSchema,
    paidAt: dateTimeSchema.optional(),
    failureReason: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;
