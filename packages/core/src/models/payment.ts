import { z } from "zod";
import { amountSchema, currencyCodeSchema, dateTimeSchema, timestampsSchema } from "./shared";

export const paymentStatusSchema = z
  .enum(["pending", "authorized", "succeeded", "failed", "refunded"])
  .describe("State of a single charge.");

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentProviderSchema = z
  .enum(["paypal"])
  .describe("Payment provider handling the charge.");

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentSchema = z
  .object({
    id: z.string(),
    rentalId: z.string(),
    billingAgreementId: z
      .string()
      .optional()
      .describe("Billing agreement the charge was taken under, when recurring."),
    billingCycle: z.number().int().positive().describe("1-based week number within the rental."),
    provider: paymentProviderSchema,
    externalOrderId: z.string().describe("Provider-side order identifier."),
    externalPaymentId: z
      .string()
      .optional()
      .describe("Provider-side payment identifier once the charge settles."),
    amount: amountSchema.describe("Amount charged for this billing cycle."),
    currency: currencyCodeSchema,
    status: paymentStatusSchema,
    paidAt: dateTimeSchema.optional().describe("When the charge succeeded."),
    failureReason: z
      .string()
      .optional()
      .describe("Provider-supplied reason when the charge failed."),
  })
  .extend(timestampsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;
