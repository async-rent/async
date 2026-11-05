import { dateSchema, rentalNumberSchema } from "@async-rent/core";
import { z } from "zod";

import { addDays, rentalWeeksSchema, type RentalWeeks } from "./rental-plan";

/**
 * What the checkout form collects. The browser checks it before submitting,
 * and the server parses it again, so both show the same messages.
 */
export const checkoutDetailsSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Enter an email like you@example.com" })),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+[1-9][\d\s().-]{6,19}$/, {
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

export type CheckoutField = keyof CheckoutDetailsInput;

/** The form plus the plan it was placed under: the city, the delivery day and the rental length. */
export const placeOrderInputSchema = checkoutDetailsSchema.extend({
  locationId: z.string(),
  deliveryDate: dateSchema,
  weeks: rentalWeeksSchema,
});

export const startRentalPaymentInputSchema = z.object({ number: rentalNumberSchema });

/** The contact details a signed-in visitor's form starts with. */
export interface CheckoutContact {
  email: string;
  whatsapp: string;
}

/** How many delivery days the checkout offers side by side. */
const deliveryDayCount = 3;

/**
 * The delivery days offered at checkout: the planned day, then the next days
 * the courier runs. Deliveries skip Sundays, as in the design; the planned day
 * is kept whatever it is, since the visitor picked it.
 */
export function deliveryDayOptions(plannedDate: string): string[] {
  const days = [plannedDate];

  let date = plannedDate;
  while (days.length < deliveryDayCount) {
    date = addDays(date, 1);
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

/**
 * Where PayPal sends the customer back to, with the order number in `rental`.
 * The pages themselves arrive with #22.
 */
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
