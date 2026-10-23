import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { metadataSchema } from "../utils/metadata";

/**
 * Customers and the contact details used for delivery updates.
 *
 * Checkout collects email and WhatsApp only. Clerk supplies the authenticated
 * identity, while a customer may also exist as a guest record keyed by email.
 */

/** Lifecycle state of a customer record. */
export const customerStatusSchema = z
  .enum(["active", "blocked", "deleted"])
  .describe("Whether the customer can place new rentals.");

/**
 * Contact details snapshot.
 *
 * The same shape is captured on a rental so later profile edits do not change
 * historical delivery records.
 */
export const contactSchema = z.object({
  name: z.string().optional().describe("Customer or recipient name."),
  email: z.string().describe("Email address used for receipts and delivery updates."),
  whatsapp: z.string().optional().describe("WhatsApp number used for delivery coordination."),
  locale: z.string().optional().describe('Preferred locale, e.g. "en-ID".'),
});

export type Contact = z.infer<typeof contactSchema>;

export const customerSchema = z
  .object({
    id: z.string().describe("Stable customer identifier."),
    clerkUserId: z
      .string()
      .optional()
      .describe("Clerk user id when the customer is authenticated; absent for guests."),
    status: customerStatusSchema,
    contact: contactSchema.describe("Primary contact details for the customer."),
    defaultLocationId: z.string().optional().describe("Location the customer usually rents from."),
    defaultAddressId: z.string().optional().describe("Address used by default at checkout."),
    preferredCurrency: currencyCodeSchema
      .optional()
      .describe(
        "Currency the customer prefers to see prices in; defaults to the location currency.",
      ),
    marketingConsent: z
      .boolean()
      .optional()
      .describe("Whether the customer opted into marketing messages."),
    metadata: metadataSchema.optional().describe("Integration-specific customer attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type Customer = z.infer<typeof customerSchema>;

/** Minimal customer reference embedded in records. */
export const customerRefSchema = customerSchema.pick({
  id: true,
  contact: true,
});

export type CustomerRef = z.infer<typeof customerRefSchema>;
