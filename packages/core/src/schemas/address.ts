import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { geoPointSchema } from "../utils/geo-point";

/**
 * Delivery addresses.
 *
 * The checkout form collects a street address, city and postcode. `area` and
 * `deliveryNotes` cover the informal directions common in Bali ("behind the
 * warung", "WhatsApp before arrival").
 */
export const addressSchema = z
  .object({
    id: z.string().describe("Stable address identifier."),
    customerId: z.string().optional().describe("Customer that owns this saved address."),
    locationId: z.string().optional().describe("Location the address belongs to."),
    serviceAreaId: z
      .string()
      .optional()
      .describe("Service area that covers the address, used for delivery eligibility."),
    label: z.string().optional().describe('Short label such as "Home" or "Villa".'),
    recipientName: z.string().optional().describe("Person the delivery should be addressed to."),
    phone: z.string().optional().describe("Phone number the delivery team should call on arrival."),
    line1: z.string().describe('Primary street address, e.g. "Jl. Pantai Batu Bolong 60".'),
    line2: z.string().optional().describe("Apartment, villa, floor or unit details."),
    area: z.string().optional().describe('Neighbourhood or district, e.g. "Canggu".'),
    city: z.string().describe("City for delivery."),
    postcode: z.string().optional().describe("Postal code."),
    countryCode: z.string().optional().describe("ISO 3166-1 alpha-2 country code."),
    coordinates: geoPointSchema.optional(),
    deliveryNotes: z.string().optional().describe("Instructions shown to the delivery team."),
    accessNotes: z
      .string()
      .optional()
      .describe("Access details such as gate codes, parking or stairs."),
    isDefault: z.boolean().optional().describe("Whether this is the customer's default address."),
  })
  .extend(auditFieldsSchema.shape);

export type Address = z.infer<typeof addressSchema>;

/**
 * Address snapshot stored on a rental.
 *
 * Rental history must not change when a customer edits or deletes a saved
 * address, so the full address is copied at checkout.
 */
export const addressSnapshotSchema = addressSchema.omit({
  id: true,
  customerId: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
});

export type AddressSnapshot = z.infer<typeof addressSnapshotSchema>;
