import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { dateSchema } from "../utils/date";
import { dateTimeSchema } from "../utils/date-time";
import { metadataSchema } from "../utils/metadata";
import { moneySchema } from "../utils/money";
import { exchangeRateSchema } from "./currency";
import { imageSchema } from "./media";
import { chargeSummarySchema } from "./pricing";
import { productKindSchema } from "./product";

/**
 * The shopping cart.
 *
 * The cart drawer holds the location, rental length, delivery date and the
 * quick-add items. Prices are snapshotted into the cart currency so that a
 * catalog or FX change cannot silently reprice an open cart.
 */

/** Lifecycle state of a cart. */
export const cartStatusSchema = z
  .enum(["active", "converted", "abandoned", "expired"])
  .describe("Whether the cart can still be checked out.");

/** Bundle composition snapshot stored on a cart line. */
export const cartBundleItemSchema = z.object({
  productId: z.string().describe("Included product id."),
  label: z.string().optional().describe('Display label override, e.g. "Task chair".'),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Units included in the bundle; defaults to 1."),
});

export type CartBundleItem = z.infer<typeof cartBundleItemSchema>;

/** One product or bundle line in the cart. */
export const cartItemSchema = z.object({
  id: z.string().describe("Stable cart-line identifier."),
  productId: z.string().describe("Product being rented."),
  productOfferingId: z
    .string()
    .optional()
    .describe("Location offering used for price and availability."),
  productSlug: z.string().optional().describe("Product slug for linking back to the catalog."),
  name: z.string().describe("Product name snapshot rendered in the cart."),
  kind: productKindSchema.optional(),
  image: imageSchema.optional().describe("Product image snapshot rendered in the cart."),
  bundleItems: z
    .array(cartBundleItemSchema)
    .optional()
    .describe("Bundle contents snapshot; present when the line is a bundle."),
  quantity: z.number().int().positive().describe("Number of units in the cart."),
  weeklyPrice: moneySchema.describe("Weekly price snapshot in the cart currency."),
  deposit: moneySchema.optional().describe("Deposit snapshot for this line, when one applies."),
  deliveryFee: moneySchema
    .optional()
    .describe("Delivery and setup fee snapshot for this line, when applicable."),
  addedAt: dateTimeSchema.optional().describe("When the line was added to the cart."),
  notes: z.string().optional().describe("Customer instructions for this line."),
  metadata: metadataSchema.optional().describe("Integration-specific cart-line attributes."),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z
  .object({
    id: z.string().describe("Stable cart identifier."),
    customerId: z.string().optional().describe("Authenticated customer, when known."),
    sessionId: z.string().optional().describe("Anonymous session id for guest carts."),
    status: cartStatusSchema,
    locationId: z.string().describe("Location the cart is priced and delivered for."),
    currency: currencyCodeSchema.describe("Currency used for every amount in the cart."),
    rentalWeeks: z
      .number()
      .int()
      .positive()
      .describe("Selected rental length in weeks, e.g. 1, 2 or 4."),
    deliveryDate: dateSchema.optional().describe("Preferred delivery date selected in the cart."),
    deliverySlotId: z
      .string()
      .optional()
      .describe("Selected delivery slot, when the customer has chosen one."),
    addressId: z.string().optional().describe("Saved address selected for delivery."),
    items: z.array(cartItemSchema).describe("Lines currently in the cart."),
    summary: chargeSummarySchema
      .optional()
      .describe("Computed totals; recomputed by the outer layer on every change."),
    promotionIds: z.array(z.string()).optional().describe("Promotions applied to the cart."),
    exchangeRate: exchangeRateSchema
      .optional()
      .describe("USD conversion snapshot used when the cart currency is not USD."),
    notes: z.string().optional().describe("Customer notes for the whole rental."),
    expiresAt: dateTimeSchema.optional().describe("When the cart and its price snapshots expire."),
    metadata: metadataSchema.optional().describe("Integration-specific cart attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type Cart = z.infer<typeof cartSchema>;
