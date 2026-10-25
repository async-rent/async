import { z } from "zod";
import { chargeSummarySchema } from "./checkout";
import { paymentStatusSchema } from "./payment";
import {
  currencyCodeSchema,
  dateSchema,
  dateTimeSchema,
  imageSchema,
  amountSchema,
  timeWindowSchema,
  timestampsSchema,
} from "../utils";

/**
 * The rental agreement created at checkout.
 *
 * Contact, address and line prices are snapshots so later catalog or profile
 * edits do not rewrite a historical order. The MVP has one delivery per
 * rental; a separate delivery-job aggregate is not needed yet.
 */

export const contactSchema = z.object({
  name: z.string(),
  email: z.email(),
  whatsapp: z.string().optional(),
});

export type Contact = z.infer<typeof contactSchema>;

export const addressSchema = z.object({
  line1: z.string().describe('Street address, e.g. "Jl. Pantai Batu Bolong 60".'),
  line2: z.string().optional().describe("Villa, unit or floor details."),
  area: z.string().optional().describe('Neighbourhood, e.g. "Canggu".'),
  city: z.string(),
  postcode: z.string().optional(),
  countryCode: z.string().describe('ISO 3166-1 alpha-2 code, e.g. "ID".'),
  deliveryNotes: z
    .string()
    .optional()
    .describe('Directions common in Bali, e.g. "behind the warung".'),
});

export type Address = z.infer<typeof addressSchema>;

export const rentalStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "active",
  "completed",
  "cancelled",
]);

export type RentalStatus = z.infer<typeof rentalStatusSchema>;

export const fulfillmentStatusSchema = z.enum(["scheduled", "in_transit", "delivered", "returned"]);

export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

export const rentalItemSchema = z.object({
  productId: z.string(),
  name: z.string().describe("Product name snapshot."),
  slug: z.string(),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1),
  weeklyPrice: amountSchema.describe("Weekly price in the rental's currency."),
  deposit: amountSchema.optional().describe("Refundable deposit in the rental's currency."),
});

export type RentalItem = z.infer<typeof rentalItemSchema>;

export const rentalSchema = z
  .object({
    id: z.string(),
    number: z.string().describe('Human-readable order number, e.g. "AS-1042".'),
    userId: z.string().optional().describe("Stable user id, when the rental was placed signed in."),
    contact: contactSchema,
    address: addressSchema,
    locationId: z.string().describe("Stable location id the rental is delivered in."),
    currency: currencyCodeSchema.describe("Currency every amount on the rental is in."),
    items: z.array(rentalItemSchema).min(1),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
    deliveryDate: dateSchema.optional(),
    deliveryWindow: timeWindowSchema.optional(),
    status: rentalStatusSchema,
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    summary: chargeSummarySchema.describe("Amounts captured at checkout."),
    billingAgreementId: z
      .string()
      .optional()
      .describe("Agreement that bills the following weeks, when recurring."),
    paymentStatusSnapshot: paymentStatusSchema
      .optional()
      .describe("Denormalized copy of the latest payment status for fast reads."),
    termsAcceptedAt: dateTimeSchema.optional(),
    cancelledAt: dateTimeSchema.optional(),
    notes: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Rental = z.infer<typeof rentalSchema>;
