import {
  isBillingCycleInRental,
  rentalNumberSchema,
  type BillingAgreement,
  type ChargeSummary,
  type Payment,
  type Rental,
  type RentalStatus,
} from "@async-rent/core";
import { z } from "zod";

import type { OrderLine } from "./checkout";

/** Rentals per page of My rentals. */
export const myRentalsPageSize = 10;

/** Pages past this one are never listed; core caps its page number there. */
export const myRentalsMaxPage = 100;

/** A page of the signed-in customer's rentals. */
export const myRentalsInputSchema = z.object({
  page: z.number().int().positive().max(myRentalsMaxPage),
});

/** One of the signed-in customer's rentals, by its number. */
export const myRentalInputSchema = z.object({ number: rentalNumberSchema });

/** My rentals carries its page in `page`; anything else reads as the first. */
export const myRentalsSearchSchema = z.object({
  page: z.number().int().min(2).max(myRentalsMaxPage).optional().catch(undefined),
});

/** One rental as the My rentals list shows it: no ids, contact or address. */
export interface RentalListItem {
  number: string;
  status: RentalStatus;
  /** The city the rental is delivered in, or `undefined` once it is no longer listed. */
  city: string | undefined;
  lines: OrderLine[];
  currency: string;
  /** The day the next weekly charge falls, or `null` when none is coming. */
  nextChargeDate: string | null;
  weeksPaid: number;
}

export interface RentalListPage {
  items: RentalListItem[];
  page: number;
  pageCount: number;
  total: number;
}

/** One charge of a rental, as its page lists it. */
export interface RentalPaymentView {
  billingCycle: number;
  amount: number;
  currency: string;
  status: Payment["status"];
  /** When it was paid, else when it was attempted, as an ISO timestamp. */
  at: string;
}

/** The weekly charges after the first week, as the rental's page shows them. */
export interface BillingPlanView {
  status: BillingAgreement["status"];
  /** Declined charges in a row. */
  failedAttempts: number;
}

/** One of the customer's rentals with everything its own page shows. */
export interface RentalDetail extends RentalListItem {
  locationId: string;
  startDate: string;
  endDate: string | undefined;
  deliveryDate: string;
  deliveryWindow: { start: string; end: string } | undefined;
  /** Weeks billed, or `null` for a rental that runs until it is ended. */
  weeks: number | null;
  delivered: boolean;
  contact: { name: string; email: string; whatsapp: string | undefined };
  address: {
    line1: string;
    line2: string | undefined;
    area: string | undefined;
    city: string;
    postcode: string | undefined;
    deliveryNotes: string | undefined;
  };
  summary: ChargeSummary;
  payments: RentalPaymentView[];
  /** `null` until the first week is paid. */
  billingPlan: BillingPlanView | null;
  placedAt: string;
  cancelledAt: string | undefined;
}

/** What a customer reads for each rental status. */
export const rentalStatusLabels: Record<RentalStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** What a customer reads for each charge's status. */
export const paymentStatusLabels: Record<Payment["status"], string> = {
  pending: "Not paid",
  authorized: "Processing",
  succeeded: "Paid",
  failed: "Declined",
  refunded: "Refunded",
};

/** The rental's lines as an order card lists them. */
export function rentalLines(rental: Rental): OrderLine[] {
  return rental.items.map((item) => ({
    productId: item.productId,
    name: item.name,
    image: item.image,
    quantity: item.quantity,
    weeklyPrice: item.weeklyPrice,
  }));
}

/** The weeks of a rental that are paid and not refunded. Pure. */
export function weeksPaid(payments: Payment[]): number {
  const paid = payments.filter((payment) => payment.status === "succeeded");
  return new Set(paid.map((payment) => payment.billingCycle)).size;
}

/**
 * The day the rental's Billing plan charges next, or `null` when no charge is
 * coming: the plan is paused or over, the rental is over, or the next week
 * falls after its end date. The plan's own date is the one billing uses, so a
 * declined week reads as the day it is retried. Pure.
 */
export function nextChargeDate(
  rental: Pick<Rental, "status" | "fulfillmentStatus" | "startDate" | "endDate">,
  plan: BillingAgreement | null,
  payments: Payment[],
): string | null {
  if (!plan || plan.status !== "active" || !plan.nextChargeAt) return null;
  if (rental.status !== "confirmed" && rental.status !== "active") return null;
  if (rental.fulfillmentStatus === "returned") return null;

  // A week refunded since was still billed, so billing moves past it too.
  const billed = payments.filter(
    (payment) => payment.status === "succeeded" || payment.status === "refunded",
  );
  const lastBilled = Math.max(1, ...billed.map((payment) => payment.billingCycle));
  if (!isBillingCycleInRental(rental, lastBilled + 1)) return null;

  return plan.nextChargeAt.slice(0, 10);
}

/** "3 Feb 2026" for an ISO date or timestamp, read in UTC. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date.length === 10 ? `${date}T00:00:00Z` : date));
}

/** "Desk, Chair and 2 more" for a rental's gear. */
export function gearLabel(lines: OrderLine[]): string {
  const names = lines.map((line) =>
    line.quantity > 1 ? `${line.quantity}× ${line.name}` : line.name,
  );
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}
