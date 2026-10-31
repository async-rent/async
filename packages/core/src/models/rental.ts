import { z } from "zod";
import {
  amountSchema,
  currencyCodeSchema,
  dateSchema,
  dateTimeSchema,
  imageSchema,
  timeWindowSchema,
  timestampsSchema,
} from "./shared";
import { paymentStatusSchema } from "./payment";
import { chargeSummarySchema } from "./pricing";

export const contactSchema = z.object({
  name: z.string(),
  email: z.email(),
  whatsapp: z.string().optional(),
});

export type Contact = z.infer<typeof contactSchema>;

export const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  area: z.string().optional(),
  city: z.string(),
  postcode: z.string().optional(),
  countryCode: z.string(),
  deliveryNotes: z.string().optional(),
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
  name: z.string(),
  slug: z.string(),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1),
  weeklyPrice: amountSchema,
  deposit: amountSchema.optional(),
});

export type RentalItem = z.infer<typeof rentalItemSchema>;

export const rentalSchema = z
  .object({
    id: z.string(),
    number: z.string(),
    userId: z.string().optional(),
    contact: contactSchema,
    address: addressSchema,
    locationId: z.string(),
    currency: currencyCodeSchema,
    items: z.array(rentalItemSchema).min(1),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
    deliveryDate: dateSchema.optional(),
    deliveryWindow: timeWindowSchema.optional(),
    status: rentalStatusSchema,
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    summary: chargeSummarySchema,
    billingAgreementId: z.string().optional(),
    paymentStatusSnapshot: paymentStatusSchema.optional(),
    termsAcceptedAt: dateTimeSchema.optional(),
    cancelledAt: dateTimeSchema.optional(),
    notes: z.string().optional(),
  })
  .extend(timestampsSchema.shape);

export type Rental = z.infer<typeof rentalSchema>;
