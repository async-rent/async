import { z } from "zod";
import { chargeSummarySchema } from "./checkout";
import { paymentStatusSchema } from "./payment";
import {
  dateSchema,
  dateTimeSchema,
  imageSchema,
  moneySchema,
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
  email: z.string().email(),
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
  weeklyPrice: moneySchema,
  deposit: moneySchema.optional(),
});

export type RentalItem = z.infer<typeof rentalItemSchema>;

export const rentalSchema = z
  .object({
    id: z.string(),
    number: z.string().describe('Human-readable order number, e.g. "AS-1042".'),
    clerkUserId: z.string().optional(),
    contact: contactSchema,
    address: addressSchema,
    locationSlug: z.string(),
    items: z.array(rentalItemSchema).min(1),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
    deliveryDate: dateSchema.optional(),
    deliveryWindow: timeWindowSchema.optional(),
    status: rentalStatusSchema,
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    summary: chargeSummarySchema.describe("Amounts captured at checkout."),
    paymentStatus: paymentStatusSchema.optional(),
    termsAcceptedAt: dateTimeSchema.optional(),
    cancelledAt: dateTimeSchema.optional(),
    notes: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Rental = z.infer<typeof rentalSchema>;
