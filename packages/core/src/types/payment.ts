import { z } from "zod";
import { amountSchema, currencyCodeSchema, dateTimeSchema, timestampsSchema } from "../utils";

/**
 * A single charge against a rental.
 *
 * Provider-neutral. The API creates an external order, the buyer approves it,
 * and the API confirms the charge through whichever provider `provider` names;
 * PayPal is the only adapter today, and adding another must not reshape this
 * type. Recurring scheduling lives on the billing agreement, not here — this
 * record is one settled weekly cycle. No card data ever touches Async.
 */

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
    id: z.string().describe("Stable payment id."),
    rentalId: z.string(),
    billingAgreementId: z
      .string()
      .optional()
      .describe("Agreement that schedules this charge, when the rental is recurring."),
    billingCycle: z
      .number()
      .int()
      .positive()
      .describe("Which weekly cycle this charge settles. 1 is the first week, charged today."),
    provider: paymentProviderSchema,
    externalOrderId: z.string().describe("Provider order id for this charge."),
    externalPaymentId: z
      .string()
      .optional()
      .describe("Provider transaction id after a successful charge."),
    amount: amountSchema.describe("Charged amount for this cycle, in `currency`."),
    currency: currencyCodeSchema.describe("Currency the charge was settled in."),
    status: paymentStatusSchema,
    paidAt: dateTimeSchema.optional(),
    failureReason: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Payment = z.infer<typeof paymentSchema>;
