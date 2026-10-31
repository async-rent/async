import { z } from "zod";
import { currencyCodeSchema, dateTimeSchema, timestampsSchema } from "./shared";
import { paymentProviderSchema } from "./payment";

export const billingIntervalSchema = z
  .enum(["weekly"])
  .describe("How often the agreement charges.");

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const billingAgreementStatusSchema = z
  .enum(["active", "paused", "cancelled", "completed"])
  .describe("Whether the agreement is currently charging.");

export type BillingAgreementStatus = z.infer<typeof billingAgreementStatusSchema>;

export const billingAgreementSchema = z
  .object({
    id: z.string(),
    rentalId: z.string(),
    provider: paymentProviderSchema,
    providerAgreementId: z
      .string()
      .optional()
      .describe("Agreement identifier on the provider side, once created."),
    interval: billingIntervalSchema.default("weekly"),
    currency: currencyCodeSchema,
    status: billingAgreementStatusSchema.default("active"),
    nextChargeAt: dateTimeSchema.optional().describe("When the next weekly charge is due."),
    cancelledAt: dateTimeSchema.optional().describe("When the agreement was cancelled."),
  })
  .extend(timestampsSchema.shape);

export type BillingAgreement = z.infer<typeof billingAgreementSchema>;
