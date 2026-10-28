import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema } from "../utils";

/**
 * Cart and checkout totals.
 *
 * A cart is single-currency: the currency belongs to the city the cart is in
 * and applies to every line and to every amount in the summary, so a cart can
 * never sum amounts of different currencies. Rentals are weekly. The first
 * week plus any deposit and delivery fee is captured today through the payment
 * provider; the following weeks are billed weekly by the billing agreement.
 *
 * There is no "recurring weekly" amount: every following week bills the
 * weekly subtotal, so the number would only ever repeat it.
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
});

export type ChargeSummary = z.infer<typeof chargeSummarySchema>;

/**
 * Who owns a cart.
 *
 * A signed-in visitor owns it by their user id; a guest owns it by the
 * session token their browser carries. The token itself never reaches the
 * database — only its hash does — and the token is the guest's only key to
 * the cart, so the hash is what the cart row stores.
 */
export const cartOwnerTypeSchema = z.enum(["user", "guest"]);

export const cartOwnerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user"),
    userId: z.string().describe("Stable user id of the signed-in visitor."),
  }),
  z.object({
    kind: z.literal("guest"),
    sessionToken: z.string().describe("Session token of the guest's browser."),
  }),
]);

export type CartOwner = z.infer<typeof cartOwnerSchema>;

export const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string().describe("Product name shown in the cart."),
  slug: z.string().describe("Product slug for linking back to the catalog."),
  image: imageSchema.optional(),
  quantity: z.number().int().positive().default(1),
  weeklyPrice: amountSchema.describe("Weekly price in the cart's currency."),
  deposit: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Refundable deposit per unit in the cart's currency."),
  available: z
    .boolean()
    .default(true)
    .describe(
      "False when the product is no longer offered in the cart's city. Such a " +
        "line can still be removed, but it is not priced and not part of the totals.",
    ),
});

export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().describe("Stable cart id."),
  locationId: z.string().describe("Stable location id this cart is for."),
  currency: currencyCodeSchema.describe("Currency the cart's city quotes in."),
  weeks: z
    .number()
    .int()
    .positive()
    .max(52)
    .default(1)
    .describe("Rental length in weeks. The rent itself is billed weekly."),
  items: z.array(cartItemSchema),
  summary: chargeSummarySchema,
});

export type Cart = z.infer<typeof cartSchema>;

/**
 * One priced line of a cart.
 *
 * The prices are the city's, read when the cart is read: a cart never stores
 * a price of its own, so it always shows what the city charges today.
 */
export interface PriceableLine {
  weeklyPrice: number;
  deposit?: number;
  quantity: number;
}

/**
 * The money of a cart.
 *
 * The weekly subtotal and the deposit are per unit; the delivery fee is the
 * city's, charged once for the whole order. Only the first week is due today
 * — the following weeks are billed weekly by the billing agreement, so the
 * length of the rental does not change what is captured at checkout.
 */
export function priceCart(input: {
  currency: string;
  deliveryFee: number;
  discount?: number;
  lines: PriceableLine[];
}): ChargeSummary {
  const weeklySubtotal = input.lines.reduce(
    (sum, line) => sum + line.weeklyPrice * line.quantity,
    0,
  );
  const deposit = input.lines.reduce((sum, line) => sum + (line.deposit ?? 0) * line.quantity, 0);
  const deliveryFee = input.lines.length > 0 ? input.deliveryFee : 0;
  const discount = input.discount ?? 0;

  return {
    currency: input.currency,
    weeklySubtotal,
    deposit,
    deliveryFee,
    discount,
    totalDueToday: weeklySubtotal + deposit + deliveryFee - discount,
  };
}
