import { z } from "zod";
import { addressSnapshotSchema } from "./address";
import { auditFieldsSchema } from "../utils/audit-fields";
import { currencyCodeSchema } from "../utils/currency-code";
import { dateSchema } from "../utils/date";
import { dateTimeSchema } from "../utils/date-time";
import { metadataSchema } from "../utils/metadata";
import { moneySchema } from "../utils/money";
import { timeWindowSchema } from "../utils/time-window";
import { contactSchema } from "./customer";
import { exchangeRateSchema } from "./currency";
import { imageSchema } from "./media";
import { paymentStatusSchema } from "./payment";
import { chargeSummarySchema } from "./pricing";
import { rentalPolicyRefSchema } from "./policy";
import { productKindSchema } from "./product";

/**
 * The rental agreement.
 *
 * This is the central transactional aggregate created at checkout. It holds
 * immutable snapshots of the customer contact, delivery address, product
 * names, images and prices, so later catalog or profile edits cannot change a
 * historical rental.
 */

/** Lifecycle state of the rental as a whole. */
export const rentalStatusSchema = z
  .enum([
    "draft",
    "pending_payment",
    "confirmed",
    "scheduled",
    "active",
    "swapping",
    "ending",
    "completed",
    "cancelled",
  ])
  .describe("Current stage of the rental agreement.");

/** Lifecycle state of one rented line. */
export const rentalItemStatusSchema = z
  .enum(["pending", "reserved", "delivered", "active", "swap_pending", "returned", "cancelled"])
  .describe("Current stage of the rented item.");

/** Operational fulfillment state shown to the customer. */
export const rentalFulfillmentStatusSchema = z
  .enum([
    "unfulfilled",
    "scheduled",
    "in_transit",
    "delivered",
    "returning",
    "returned",
    "cancelled",
  ])
  .describe("Where the physical delivery and return stand.");

/** State of a product swap request. */
export const rentalSwapStatusSchema = z
  .enum(["requested", "scheduled", "completed", "cancelled"])
  .describe("Current stage of a rental swap.");

/** Bundle composition snapshot stored on a rental line. */
export const rentalBundleItemSnapshotSchema = z.object({
  productId: z.string().describe("Included product id."),
  label: z.string().optional().describe("Display label used when the rental was created."),
  quantity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Units included in the bundle; defaults to 1."),
});

export type RentalBundleItemSnapshot = z.infer<typeof rentalBundleItemSnapshotSchema>;

/** One product or bundle line in a rental. */
export const rentalItemSchema = z
  .object({
    id: z.string().describe("Stable rental-line identifier."),
    rentalId: z.string().optional().describe("Parent rental, when denormalised."),
    productId: z.string().describe("Product being rented."),
    productOfferingId: z
      .string()
      .optional()
      .describe("Location offering used to price and reserve the item."),
    productSlug: z.string().optional().describe("Product slug at rental time."),
    name: z.string().describe("Product name snapshot."),
    kind: productKindSchema.optional(),
    image: imageSchema.optional().describe("Product image snapshot."),
    bundleItems: z
      .array(rentalBundleItemSnapshotSchema)
      .optional()
      .describe("Bundle contents snapshot; present when the line is a bundle."),
    quantity: z.number().int().positive().describe("Number of units rented."),
    rentalWeeks: z.number().int().positive().describe("Rental duration for this line, in weeks."),
    weeklyPrice: moneySchema.describe("Weekly price snapshot for one unit."),
    deposit: moneySchema.optional().describe("Deposit snapshot for this line, when one applies."),
    deliveryFee: moneySchema.optional().describe("Delivery and setup fee snapshot for this line."),
    assignedInventoryUnitIds: z
      .array(z.string())
      .optional()
      .describe("Physical units reserved for this line."),
    status: rentalItemStatusSchema,
    notes: z.string().optional().describe("Customer or operations notes."),
    metadata: metadataSchema.optional().describe("Integration-specific rental-line attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type RentalItem = z.infer<typeof rentalItemSchema>;

/** A swap of one rented product for another. */
export const rentalSwapSchema = z
  .object({
    id: z.string().describe("Stable swap identifier."),
    rentalId: z.string().optional().describe("Parent rental, when denormalised."),
    rentalItemId: z.string().describe("Rental line being swapped."),
    fromProductId: z.string().describe("Product currently rented."),
    toProductId: z.string().describe("Product requested in the swap."),
    toProductOfferingId: z
      .string()
      .optional()
      .describe("Location offering used to price the replacement product."),
    priceDifference: moneySchema
      .optional()
      .describe("Weekly price difference charged or credited for the swap."),
    status: rentalSwapStatusSchema,
    requestedAt: dateTimeSchema.describe("When the customer requested the swap."),
    scheduledFor: dateTimeSchema.optional().describe("When the swap is scheduled to happen."),
    completedAt: dateTimeSchema.optional().describe("When the swap completed."),
    reason: z.string().optional().describe("Why the customer requested the swap."),
  })
  .extend(auditFieldsSchema.shape);

export type RentalSwap = z.infer<typeof rentalSwapSchema>;

/**
 * A completed checkout and the ongoing weekly rental it created.
 *
 * The rental is the source of truth for "what did this customer rent, where,
 * for how long, at what price and on which terms". Payments, deliveries,
 * swaps and reservations all point back to it.
 */
export const rentalSchema = z
  .object({
    id: z.string().describe("Stable rental identifier."),
    number: z.string().describe('Human-readable rental number, e.g. "AS-1042".'),
    customerId: z.string().optional().describe("Customer who owns the rental."),
    contact: contactSchema.describe("Contact snapshot used for receipts and delivery updates."),
    locationId: z.string().describe("Location the rental is delivered from."),
    address: addressSnapshotSchema.describe("Delivery address snapshot captured at checkout."),
    deliverySlotId: z.string().optional().describe("Delivery slot chosen at checkout."),
    deliveryDate: dateSchema.optional().describe("Scheduled delivery date."),
    deliveryWindow: timeWindowSchema.optional().describe("Scheduled delivery window."),
    rentalWeeks: z.number().int().positive().describe("Rental length in weeks."),
    startDate: dateSchema.describe("First day of the rental."),
    endDate: dateSchema.optional().describe("Expected last day of the rental."),
    status: rentalStatusSchema,
    items: z.array(rentalItemSchema).describe("Products included in the rental."),
    swaps: z
      .array(rentalSwapSchema)
      .optional()
      .describe("Product swaps requested during the rental."),
    currency: currencyCodeSchema.describe("Currency used for every amount in the rental."),
    summary: chargeSummarySchema.describe("Immutable charge summary captured at checkout."),
    exchangeRate: exchangeRateSchema
      .optional()
      .describe("USD conversion snapshot used when the rental currency is not USD."),
    rentalPolicy: rentalPolicyRefSchema
      .optional()
      .describe("Policy and version the customer accepted."),
    paymentStatus: paymentStatusSchema
      .optional()
      .describe("Current payment state for quick rendering."),
    fulfillmentStatus: rentalFulfillmentStatusSchema
      .optional()
      .describe("Current fulfillment state for quick rendering."),
    termsVersion: z
      .string()
      .optional()
      .describe("Version of the rental terms accepted at checkout."),
    termsAcceptedAt: dateTimeSchema
      .optional()
      .describe("When the customer accepted the rental and delivery terms."),
    cancelledAt: dateTimeSchema.optional().describe("When the rental was cancelled."),
    cancellationReason: z.string().optional().describe("Why the rental was cancelled."),
    notes: z.string().optional().describe("Customer notes for the rental."),
    metadata: metadataSchema.optional().describe("Integration-specific rental attributes."),
  })
  .extend(auditFieldsSchema.shape);

export type Rental = z.infer<typeof rentalSchema>;
