import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateTimeSchema } from "../utils/date-time";
import { metadataSchema } from "../utils/metadata";
import { moneySchema } from "../utils/money";
import { percentageSchema } from "../utils/percentage";

/**
 * Promotions, campaigns and redemptions.
 *
 * The catalog hero ("Free setup", "From $25 / week") and bundle savings are
 * merchandising objects. A promotion can be applied automatically or through a
 * code, and is scoped to products, categories and locations.
 */

/** Lifecycle state of a promotion. */
export const promotionStatusSchema = z
  .enum(["draft", "scheduled", "active", "expired", "disabled"])
  .describe("Whether the promotion is currently available.");

/** What the promotion discounts. */
export const promotionTypeSchema = z
  .enum([
    "percentage",
    "fixed_amount",
    "free_delivery",
    "free_setup",
    "free_week",
    "bundle_savings",
  ])
  .describe("Mechanism used to calculate the discount.");

/**
 * What a promotion applies to.
 *
 * An omitted scope list means "all". Lists are combined as an intersection:
 * a product must match every list that is present.
 */
export const promotionScopeSchema = z.object({
  productIds: z
    .array(z.string())
    .optional()
    .describe("Specific products the promotion applies to."),
  categoryIds: z.array(z.string()).optional().describe("Categories the promotion applies to."),
  locationIds: z.array(z.string()).optional().describe("Locations where the promotion is valid."),
});

export type PromotionScope = z.infer<typeof promotionScopeSchema>;

/**
 * A discount or merchandising campaign.
 *
 * Exactly which value field is required depends on `type`; that cross-field
 * rule belongs to the outer validation layer.
 */
export const promotionSchema = z
  .object({
    id: z.string().describe("Stable promotion identifier."),
    code: z.string().optional().describe("Coupon code when the promotion is not auto-applied."),
    name: z.string().describe('Internal name, e.g. "Autumn free setup".'),
    headline: z.string().optional().describe('Customer-facing headline, e.g. "Free setup".'),
    description: z.string().optional().describe("Customer-facing explanation of the promotion."),
    type: promotionTypeSchema,
    percentOff: percentageSchema
      .optional()
      .describe("Percentage discount when `type` is `percentage`."),
    amountOff: moneySchema
      .optional()
      .describe(
        "Fixed discount when `type` is `fixed_amount`; express cross-location promotions in USD.",
      ),
    appliesTo: promotionScopeSchema
      .optional()
      .describe("Products, categories and locations the promotion covers."),
    autoApply: z.boolean().optional().describe("Whether the promotion is applied without a code."),
    startsAt: dateTimeSchema.optional().describe("When the promotion becomes valid."),
    endsAt: dateTimeSchema.optional().describe("When the promotion expires."),
    maxRedemptions: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Total number of times the promotion can be used."),
    redemptionCount: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Times the promotion has been used so far."),
    perCustomerLimit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum redemptions per customer."),
    stackable: z
      .boolean()
      .optional()
      .describe("Whether the promotion can be combined with other promotions."),
    priority: z
      .number()
      .int()
      .optional()
      .describe("Order in which overlapping promotions are evaluated."),
    status: promotionStatusSchema,
    termsUrl: z.string().optional().describe("Public URL of the promotion terms."),
    metadata: metadataSchema.optional().describe("Integration-specific promotion attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type Promotion = z.infer<typeof promotionSchema>;

/** State of a redemption. */
export const promotionRedemptionStatusSchema = z
  .enum(["applied", "reversed"])
  .describe("Whether the discount is still applied.");

/** A record of a promotion being used on a cart or rental. */
export const promotionRedemptionSchema = z
  .object({
    id: z.string().describe("Stable redemption identifier."),
    promotionId: z.string().describe("Promotion that was redeemed."),
    customerId: z.string().optional().describe("Customer who redeemed it."),
    cartId: z.string().optional().describe("Cart the discount applied to."),
    rentalId: z.string().optional().describe("Rental the discount applied to."),
    code: z.string().optional().describe("Code used, when applicable."),
    discountAmount: moneySchema.describe("Value of the discount granted."),
    status: promotionRedemptionStatusSchema,
    redeemedAt: dateTimeSchema.optional().describe("When the discount was applied."),
  })
  .extend(auditFieldsSchema.shape);

export type PromotionRedemption = z.infer<typeof promotionRedemptionSchema>;
