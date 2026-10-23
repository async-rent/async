import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateSchema } from "../utils/date";
import { moneySchema } from "../utils/money";

/**
 * Rental policy shared by products, offerings and rentals.
 *
 * The storefront promises "billed weekly", "no lock-in", "cancel or swap after
 * week one" and 1/2/4 week rental lengths. Those statements live here so a
 * product can point at a single, versioned policy instead of duplicating copy
 * and rules across the catalog.
 */

/** Lifecycle state of a policy record. */
export const rentalPolicyStatusSchema = z
  .enum(["draft", "active", "retired"])
  .describe("Whether the policy can currently be attached to products.");

export const rentalPolicySchema = z
  .object({
    id: z.string().describe("Stable policy identifier."),
    name: z.string().describe('Human-readable policy name, e.g. "Standard weekly rental".'),
    version: z
      .string()
      .describe("Policy version captured on a rental so historical terms remain reproducible."),
    status: rentalPolicyStatusSchema.optional(),
    minimumWeeks: z
      .number()
      .int()
      .positive()
      .describe("Shortest commitment a customer can book, in weeks."),
    maximumWeeks: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Longest commitment a customer can book, in weeks."),
    billingCycleWeeks: z
      .number()
      .int()
      .positive()
      .describe("How often the customer is charged, in weeks."),
    cancelAnytime: z
      .boolean()
      .describe("Whether the customer can cancel without a fixed-term commitment."),
    cancellationNoticeDays: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("How many days of notice a cancellation requires."),
    cancellationFee: moneySchema
      .optional()
      .describe("Fee charged for cancelling outside the allowed window."),
    swapAllowed: z
      .boolean()
      .optional()
      .describe("Whether the customer can swap a product during the rental."),
    swapEligibleAfterWeeks: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Earliest week a swap is allowed, e.g. 1 for "after week one".'),
    swapFee: moneySchema.optional().describe("Fee charged for a swap, when applicable."),
    depositRequired: z.boolean().optional().describe("Whether a deposit is required."),
    depositRefundable: z
      .boolean()
      .optional()
      .describe("Whether the deposit is returned after the rental ends."),
    deliveryIncluded: z
      .boolean()
      .optional()
      .describe("Whether delivery is included in the weekly price."),
    setupIncluded: z
      .boolean()
      .optional()
      .describe("Whether on-site assembly and setup are included."),
    returnWindowHours: z
      .number()
      .nonnegative()
      .optional()
      .describe("Hours after the rental end during which the item can still be returned."),
    termsUrl: z.string().optional().describe("Public URL of the full rental terms."),
    deliveryPolicyUrl: z.string().optional().describe("Public URL of the delivery policy."),
    notes: z.string().optional().describe("Internal notes about the policy."),
    activeFrom: dateSchema.optional().describe("First date the policy can be used."),
    activeTo: dateSchema.optional().describe("Last date the policy can be used."),
  })
  .extend(auditFieldsSchema.shape);

export type RentalPolicy = z.infer<typeof rentalPolicySchema>;

/** Minimal policy reference stored on a rental. */
export const rentalPolicyRefSchema = rentalPolicySchema.pick({
  id: true,
  name: true,
  version: true,
});

export type RentalPolicyRef = z.infer<typeof rentalPolicyRefSchema>;
