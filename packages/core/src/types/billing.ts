import { z } from "zod";
import { currencyCodeSchema, dateTimeSchema, timestampsSchema } from "../utils";
import { paymentProviderSchema } from "./payment";

/**
 * The recurring schedule that bills a rental.
 *
 * Kept separate from a single charge: the agreement holds the cadence and the
 * next billing date, while each `Payment` records one settled weekly cycle.
 * Provider-neutral, same as payments.
 */

export const billingIntervalSchema = z.enum(["weekly"]);

export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const billingAgreementStatusSchema = z.enum(["active", "paused", "cancelled", "completed"]);

export type BillingAgreementStatus = z.infer<typeof billingAgreementStatusSchema>;

export const billingAgreementSchema = z
  .object({
    id: z.string().describe("Stable agreement id."),
    rentalId: z.string(),
    provider: paymentProviderSchema,
    providerAgreementId: z
      .string()
      .optional()
      .describe("Provider-side mandate id, once the agreement is set up."),
    interval: billingIntervalSchema.default("weekly"),
    currency: currencyCodeSchema.describe("Currency the recurring charges are billed in."),
    status: billingAgreementStatusSchema.default("active"),
    nextChargeAt: dateTimeSchema.optional().describe("When the agreement next bills."),
    cancelledAt: dateTimeSchema.optional(),
  })
  .extend(timestampsSchema.shape);

export type BillingAgreement = z.infer<typeof billingAgreementSchema>;
