import {
  dateSchema,
  rentalNumberSchema,
  type Cart,
  type ChargeSummary,
  type Image,
} from "@async-rent/core";
import { z } from "zod";

import { addDays, rentalWeeksSchema, type RentalPlan, type RentalWeeks } from "./rental-plan";

const whatsappPattern = /^\+[1-9][\d\s().-]*$/;

// E.164 numbers carry at most 15 digits; real mobile numbers carry at least 8.
function isWhatsappNumber(value: string): boolean {
  const digits = value.replace(/\D/g, "").length;
  return whatsappPattern.test(value) && digits >= 8 && digits <= 15;
}

/**
 * What the checkout form collects. The browser checks it before submitting,
 * and the server parses it again, so both show the same messages.
 */
export const checkoutDetailsSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Enter an email like you@example.com" })),
  whatsapp: z.string().trim().refine(isWhatsappNumber, {
    error: "Enter your WhatsApp number with its country code, e.g. +62 812 3456 7890",
  }),
  line1: z
    .string()
    .trim()
    .min(1, { error: "Enter the street address" })
    .max(200, { error: "Keep the address under 200 characters" }),
  city: z
    .string()
    .trim()
    .min(1, { error: "Enter the town or area" })
    .max(100, { error: "Keep the town under 100 characters" }),
  postcode: z
    .string()
    .trim()
    .max(20, { error: "Keep the postcode under 20 characters" })
    .optional()
    .transform((postcode) => postcode || undefined),
});

export type CheckoutDetailsInput = z.input<typeof checkoutDetailsSchema>;

export type CheckoutDetails = z.output<typeof checkoutDetailsSchema>;

export type CheckoutField = keyof CheckoutDetailsInput;

/** The form plus the plan it was placed under: the city, the delivery day and the rental length. */
export const placeOrderInputSchema = checkoutDetailsSchema.extend({
  locationId: z.string(),
  deliveryDate: dateSchema,
  weeks: rentalWeeksSchema,
});

/** One of the visitor's own orders, by its number. */
export const orderNumberInputSchema = z.object({ number: rentalNumberSchema });

export const startRentalPaymentInputSchema = orderNumberInputSchema;

// The provider order PayPal appends to the return URL as `token`.
const paymentTokenSchema = z.string().trim().min(1).max(64);

/**
 * The order to confirm, and the PayPal order the visitor approved. Only that
 * order is captured, so a confirm never takes money for one nobody approved.
 */
export const confirmRentalPaymentInputSchema = orderNumberInputSchema.extend({
  token: paymentTokenSchema.optional(),
});

/**
 * The pages PayPal returns to carry the order number, and on approval the
 * PayPal order in `token`; anything else reads as none.
 */
export const paymentReturnSearchSchema = z.object({
  rental: rentalNumberSchema.optional().catch(undefined),
  token: paymentTokenSchema.optional().catch(undefined),
});

/** The contact details a signed-in visitor's form starts with. */
export interface CheckoutContact {
  email: string;
  whatsapp: string;
}

/** One line of an order as the summary lists it. */
export interface OrderLine {
  productId: string;
  name: string;
  image?: Image;
  quantity: number;
  weeklyPrice: number;
}

/** What the order summary shows: an order about to be placed, or one already placed. */
export interface OrderView {
  locationId: string;
  deliveryDate: string;
  /** Weeks billed, or `null` for a rental that runs until it is ended. */
  weeks: number | null;
  currency: string;
  lines: OrderLine[];
  /** Cart lines left out because they can't be rented right now. */
  leftOut: number;
  summary: ChargeSummary;
}

/**
 * The visitor's order once placed and while its first payment is still due.
 * Checkout shows it in place of the cart until it is paid, so a reload or a
 * return from PayPal can always pay it.
 */
export interface OpenOrder extends OrderView {
  number: string;
  details: CheckoutDetails;
}

/** An order whose first week is paid, as the confirmation shows it. */
export interface PaidOrder extends OpenOrder {
  /** What the payment at checkout took, in minor units. */
  paid: number;
  /** When it was taken, as an ISO timestamp. */
  paidAt: string;
  /** Whether the setup has reached the visitor, so delivery reads as done. */
  delivered: boolean;
  /** The day the next weekly charge falls, or `null` when no week is left to bill. */
  nextChargeDate: string | null;
  /** Weekly charges still to come, the next one included; `null` until the rental is ended. */
  chargesLeft: number | null;
}

/**
 * Where an order stands once the visitor is back from approving its payment.
 * - `paid`: the payment went through and the order is confirmed.
 * - `declined`: PayPal refused the payment; nothing was charged.
 * - `processing`: PayPal holds the money but hasn't released it yet.
 * - `unfinished`: the approval was for a payment since replaced, or none was started.
 * - `refunded`: the order was paid, and that payment has since been refunded.
 * - `cancelled`: the order was cancelled, so there is nothing to pay.
 */
export type PaymentReturn =
  | { outcome: "paid"; order: PaidOrder }
  | { outcome: "declined"; order: OpenOrder; reason: string }
  | { outcome: "unfinished"; order: OpenOrder }
  | { outcome: "processing" | "refunded" | "cancelled"; number: string };

/** One of the visitor's orders, and whether it still waits for its first payment. */
export interface OwnOrder {
  status: "awaiting_payment" | "paid" | "cancelled";
  order: OpenOrder;
}

/** The order the cart would become under the plan: only its available lines. */
export function cartOrderView(cart: Cart, plan: RentalPlan): OrderView {
  const available = cart.items.filter((item) => item.available);

  return {
    locationId: cart.locationId,
    deliveryDate: plan.deliveryDate,
    weeks: plan.weeks,
    currency: cart.currency,
    lines: available.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.images[0],
      quantity: item.quantity,
      weeklyPrice: item.weeklyPrice,
    })),
    leftOut: cart.items.length - available.length,
    summary: cart.summary,
  };
}

/** How many delivery days the checkout offers side by side. */
const deliveryDayCount = 3;

/**
 * The delivery days offered at checkout: the planned day, then the next days
 * the courier runs, up to `latestDate`. Deliveries skip Sundays, as in the
 * design; the planned day is kept whatever it is, since the visitor picked it.
 */
export function deliveryDayOptions(plannedDate: string, latestDate: string): string[] {
  const days = [plannedDate];

  let date = plannedDate;
  while (days.length < deliveryDayCount) {
    date = addDays(date, 1);
    // ISO dates order the same way as strings.
    if (date > latestDate) break;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) days.push(date);
  }

  return days;
}

/**
 * The last day of a rental that starts on `startDate` and runs `weeks` whole
 * weeks. Billing stops after it, so the visitor is never charged past the
 * length they picked; they can still cancel earlier.
 */
export function rentalEndDate(startDate: string, weeks: RentalWeeks): string {
  return addDays(startDate, weeks * 7 - 1);
}

const dayMs = 24 * 60 * 60 * 1000;

/**
 * The weeks billed for a rental from `startDate` to `endDate`, both included:
 * a week is charged for every week that starts on or before the last day.
 * `null` for an open-ended rental.
 */
export function rentalWeekCount(startDate: string, endDate: string | undefined): number | null {
  if (!endDate) return null;

  const days = (Date.parse(endDate) - Date.parse(startDate)) / dayMs + 1;
  return Math.max(1, Math.ceil(days / 7));
}

/** Where PayPal sends the customer back to, with the order number in `rental`. */
export const paymentReturnPaths = {
  approved: "/checkout/approved",
  cancelled: "/checkout/cancelled",
} as const;

export function paymentReturnUrls(origin: string, number: string) {
  const url = (path: string) => {
    const target = new URL(path, origin);
    target.searchParams.set("rental", number);
    return target.href;
  };

  return {
    returnUrl: url(paymentReturnPaths.approved),
    cancelUrl: url(paymentReturnPaths.cancelled),
  };
}

/** Where shoppers reach a person, as the footer lists it. */
export const supportEmail = "hello@async.rent";
