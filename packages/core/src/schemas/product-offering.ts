import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { metadataSchema } from "../utils/metadata";
import { rentalPolicySchema } from "./policy";
import {
  productAvailabilitySchema,
  productFulfillmentSchema,
  productPricingSchema,
} from "./product";

/**
 * A product as it is sold from one location.
 *
 * This is the join between the global catalog and a physical operating city.
 * It is also where per-location pricing lives:
 *
 * - `pricing` present  → the explicit local price wins. Use this when the team
 *   sets a price for that location.
 * - `pricing` absent   → convert `product.pricing` from USD with the latest
 *   `exchangeRate` for `currency`.
 *
 * The same pattern lets a location override availability, fulfillment and the
 * rental policy without duplicating the product itself.
 */

/** Lifecycle state of an offering at a location. */
export const productOfferingStatusSchema = z
  .enum(["active", "inactive", "coming_soon", "sold_out"])
  .describe("Whether the product can be rented at this location.");

export const productOfferingSchema = z
  .object({
    id: z.string().describe("Stable offering identifier."),
    productId: z.string().describe("Product being offered."),
    locationId: z.string().describe("Location where the product is offered."),
    status: productOfferingStatusSchema,
    currency: currencyCodeSchema.describe(
      "Currency used to display and charge this offer. Normally matches the location currency.",
    ),
    pricing: productPricingSchema
      .optional()
      .describe(
        "Explicit local pricing, including weekly rate, deposit, delivery fee and tax. When omitted, the product's USD price is converted using the latest exchange rate and the location's tax treatment applies. Omitted pricing fields fall back to the converted product value.",
      ),
    availability: productAvailabilitySchema
      .optional()
      .describe("Location-specific stock snapshot; overrides the product value."),
    fulfillment: productFulfillmentSchema
      .optional()
      .describe("Location-specific delivery and setup promise; overrides the product value."),
    rentalPolicy: rentalPolicySchema
      .optional()
      .describe("Location-specific rental terms; overrides the product policy."),
    isFeatured: z
      .boolean()
      .optional()
      .describe("Whether the offering should be promoted on the location's storefront."),
    sortOrder: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Manual ordering within the location catalog."),
    metadata: metadataSchema.optional().describe("Integration-specific offering attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type ProductOffering = z.infer<typeof productOfferingSchema>;

/** Minimal offering reference embedded in orders and reservations. */
export const productOfferingRefSchema = productOfferingSchema.pick({
  id: true,
  productId: true,
  locationId: true,
  currency: true,
});

export type ProductOfferingRef = z.infer<typeof productOfferingRefSchema>;
