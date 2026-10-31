import { z } from "zod";
import { currencyCodeSchema, dateTimeSchema, timestampsSchema } from "./shared";
import { paymentProviderSchema } from "./payment";

export const billingIntervalSchema = z.enum(["weekly"]);

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const billingAgreementStatusSchema = z.enum(["active", "paused", "cancelled", "completed"]);

export type BillingAgreementStatus = z.infer<typeof billingAgreementStatusSchema>;

export const billingAgreementSchema = z
  .object({
    id: z.string(),
    rentalId: z.string(),
    provider: paymentProviderSchema,
    providerAgreementId: z.string().optional(),
    interval: billingIntervalSchema.default("weekly"),
    currency: currencyCodeSchema,
    status: billingAgreementStatusSchema.default("active"),
    nextChargeAt: dateTimeSchema.optional(),
    cancelledAt: dateTimeSchema.optional(),
  })
  .extend(timestampsSchema.shape);

export type BillingAgreement = z.infer<typeof billingAgreementSchema>;
