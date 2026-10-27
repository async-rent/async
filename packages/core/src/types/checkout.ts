import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "../utils";

/**
 * Cart and checkout totals.
 *
 * A cart is single-currency: `summary.currency` applies to every line and to
 * every amount in the summary, so a cart can never sum amounts of different
 * currencies. Rentals are weekly. The first week plus any deposit and delivery
 * fee is captured today through the payment provider; the following weeks are
 * billed weekly by the billing agreement.
 */

export const chargeSummarySchema = z.object({
  currency: currencyCodeSchema.describe("Currency for the whole cart; every amount is in it."),
  weeklySubtotal: amountSchema.describe("Sum of weekly line prices."),
  deposit: amountSchema.default(0).describe("Refundable deposit."),
  deliveryFee: amountSchema.default(0).describe("Delivery and setup charge for the whole order."),
  discount: amountSchema.default(0).describe("Any discount applied at checkout."),
  totalDueToday: amountSchema.describe(
    "Amount captured at checkout: weeklySubtotal + deposit + deliveryFee − discount.",
  ),
  recurringWeekly: amountSchema.describe("Amount charged every week after the first week."),
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string().describe("Product name snapshot shown in the cart."),
  slug: z.string().describe("Product slug for linking back to the catalog."),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1),
  weeklyPrice: amountSchema.describe("Weekly price in the cart's currency."),
  deposit: amountSchema.optional().describe("Refundable deposit in the cart's currency."),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().describe("Stable cart id."),
  customerId: z.string().optional().describe("Stable user id, when signed in."),
  locationId: z.string().describe("Stable location id this cart is for."),
  items: z.array(cartItemSchema),
  summary: chargeSummarySchema,
  expiresAt: z.string().optional().describe("When the price snapshot expires."),
});

export type Cart = z.infer<typeof cartSchema>;

/**
 * Adds one product to the visitor's cart, starting a cart when there is none.
 *
 * A cart is single-city and single-currency: `locationId` picks the city a new
 * cart is opened in, and is checked against an existing cart's city when one is
 * passed. `customerId` lets a signed-in visitor's cart be found again without a
 * stored cart id; a guest is identified by the returned cart id.
 */
export const addCartItemSchema = z.object({
  cartId: z.string().optional().describe("Existing cart to add to; omit to start a new cart."),
  customerId: z.string().optional().describe("Stable user id, when signed in."),
  locationId: z
    .string()
    .describe("Stable location id: the city a new cart opens in, checked against an existing one."),
  productId: z.string().describe("Stable product id to add."),
  quantity: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Units to add. Adding a product already in the cart merges into its line."),
});

export type AddCartItem = z.infer<typeof addCartItemSchema>;

/** Sets a cart line's quantity to an exact new value. */
export const updateCartItemQuantitySchema = z.object({
  cartId: z.string().describe("Cart holding the line."),
  productId: z.string().describe("Stable product id of the line to change."),
  quantity: z.number().int().positive().describe("New unit count for the line."),
});

export type UpdateCartItemQuantity = z.infer<typeof updateCartItemQuantitySchema>;

/** Removes a cart line. */
export const removeCartItemSchema = z.object({
  cartId: z.string().describe("Cart holding the line."),
  productId: z.string().describe("Stable product id of the line to remove."),
});

export type RemoveCartItem = z.infer<typeof removeCartItemSchema>;
