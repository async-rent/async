import { z } from "zod";
import { amountSchema, currencyCodeSchema, dateTimeSchema, timestampsSchema } from "./shared";

export const paymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "refunded",
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentProviderSchema = z.enum(["paypal"]);

export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const paymentSchema = z
  .object({
    id: z.string(),
    rentalId: z.string(),
    billingAgreementId: z.string().optional(),
    billingCycle: z.number().int().positive(),
    provider: paymentProviderSchema,
    externalOrderId: z.string(),
    externalPaymentId: z.string().optional(),
    amount: amountSchema,
    currency: currencyCodeSchema,
    status: paymentStatusSchema,
    paidAt: dateTimeSchema.optional(),
    failureReason: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;
