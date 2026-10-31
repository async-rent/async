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
  email: z.email().describe("Email used for rental updates and receipts."),
  whatsapp: z.string().optional().describe("Optional WhatsApp number for delivery coordination."),
});

export type Contact = z.infer<typeof contactSchema>;

export const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  area: z.string().optional(),
  city: z.string(),
  postcode: z.string().optional(),
  countryCode: z.string().describe("ISO 3166-1 alpha-2 country code, e.g. ID."),
  deliveryNotes: z.string().optional().describe("Access or drop-off instructions for the courier."),
});

export type Address = z.infer<typeof addressSchema>;

export const rentalStatusSchema = z
  .enum(["pending_payment", "confirmed", "active", "completed", "cancelled"])
  .describe("Lifecycle state of the rental.");

export type RentalStatus = z.infer<typeof rentalStatusSchema>;

export const fulfillmentStatusSchema = z
  .enum(["scheduled", "in_transit", "delivered", "returned"])
  .describe("Where the gear is in the delivery and return flow.");

export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;

export const rentalItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1).describe("Units rented."),
  weeklyPrice: amountSchema.describe("Agreed rental price per week when the rental was placed."),
  deposit: amountSchema.optional().describe("Refundable deposit charged once per unit."),
});

export type RentalItem = z.infer<typeof rentalItemSchema>;

export const rentalSchema = z
  .object({
    id: z.string(),
    number: z.string().describe("Human-readable rental reference shown to the customer."),
    userId: z.string().optional().describe("Signed-in user who placed the rental, if any."),
    contact: contactSchema,
    address: addressSchema,
    locationId: z.string().describe("Location the rental ships from."),
    currency: currencyCodeSchema,
    items: z.array(rentalItemSchema).min(1),
    startDate: dateSchema.describe("First day of the rental period."),
    endDate: dateSchema
      .optional()
      .describe("Last day of the rental period; open-ended when omitted."),
    deliveryDate: dateSchema.optional().describe("Day the gear is dropped off."),
    deliveryWindow: timeWindowSchema.optional(),
    status: rentalStatusSchema,
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    summary: chargeSummarySchema.describe("Agreed charges, frozen when the rental was placed."),
    billingAgreementId: z
      .string()
      .optional()
      .describe("Billing agreement that charges the recurring weekly payments."),
    paymentStatusSnapshot: paymentStatusSchema
      .optional()
      .describe("Latest known payment status, copied here to avoid a join."),
    termsAcceptedAt: dateTimeSchema.optional().describe("When the customer accepted the terms."),
    cancelledAt: dateTimeSchema.optional().describe("When the rental was cancelled."),
    notes: z.string().optional().describe("Internal notes, not shown to the customer."),
  })
  .extend(timestampsSchema.shape);

export type Rental = z.infer<typeof rentalSchema>;
