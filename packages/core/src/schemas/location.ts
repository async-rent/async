import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { geoPointSchema } from "../utils/geo-point";
import { taxSchema } from "./pricing";

/**
 * Physical operating locations.
 *
 * Async currently works in Bali, Chiang Mai, Da Nang and Lisbon. A location
 * owns its local currency, support contacts, delivery areas and tax rules.
 * Product offerings, delivery slots and inventory units all reference a
 * location.
 */

/** Lifecycle state of a location. */
export const locationStatusSchema = z
  .enum(["active", "coming_soon", "inactive"])
  .describe("Whether customers can rent from this location.");

/** A delivery area inside a location. */
export const serviceAreaSchema = z.object({
  id: z.string().describe("Stable service-area identifier."),
  name: z.string().describe('Human-readable area name, e.g. "Canggu".'),
  city: z.string().describe("City the area belongs to."),
  postcodes: z
    .array(z.string())
    .optional()
    .describe("Postcodes covered by this area, when delivery is postcode-based."),
  coordinates: geoPointSchema.optional(),
  radiusKm: z
    .number()
    .positive()
    .optional()
    .describe("Delivery radius from the area centre, when radius-based."),
  isActive: z.boolean().optional().describe("Whether the area is currently serviceable."),
});

export type ServiceArea = z.infer<typeof serviceAreaSchema>;

export const locationSchema = z
  .object({
    id: z.string().describe("Stable location identifier."),
    slug: z.string().describe('URL-safe location key, e.g. "bali".'),
    name: z.string().describe('Display name, e.g. "Bali".'),
    country: z.string().describe('Country display name, e.g. "Indonesia".'),
    countryCode: z.string().describe('ISO 3166-1 alpha-2 country code, e.g. "ID".'),
    timezone: z.string().describe('IANA timezone, e.g. "Asia/Makassar".'),
    locale: z.string().describe('Default locale, e.g. "en-ID".'),
    currency: currencyCodeSchema.describe(
      "Local currency used for display and charging at this location.",
    ),
    supportPhone: z.string().optional().describe("Local customer-service phone number."),
    supportWhatsapp: z.string().optional().describe("Local customer-service WhatsApp number."),
    supportEmail: z.string().optional().describe("Local customer-service email address."),
    address: z.string().optional().describe("Street address of the local hub or warehouse."),
    coordinates: geoPointSchema.optional(),
    serviceAreas: z
      .array(serviceAreaSchema)
      .optional()
      .describe("Delivery areas covered by this location."),
    orderCutoffHour: z
      .number()
      .int()
      .min(0)
      .max(23)
      .optional()
      .describe("Local hour after which next-day delivery can no longer be booked."),
    deliveryLeadTimeHours: z
      .number()
      .positive()
      .optional()
      .describe("Default delivery lead time in hours, e.g. 24."),
    tax: taxSchema.optional().describe("Default tax treatment applied to prices in this location."),
    isDefault: z
      .boolean()
      .optional()
      .describe("Whether this is the default location for new visitors."),
    status: locationStatusSchema,
  })
  .extend(auditFieldsSchema.shape);

export type Location = z.infer<typeof locationSchema>;

/** Minimal location reference embedded in offers and records. */
export const locationRefSchema = locationSchema.pick({
  id: true,
  slug: true,
  name: true,
  currency: true,
});

export type LocationRef = z.infer<typeof locationRefSchema>;
