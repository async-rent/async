import type { BillingAgreement, Location, Payment, Rental } from "@async-rent/core";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";

import { rentalWeekCount, supportEmail } from "../lib/checkout";
import {
  myRentalInputSchema,
  myRentalsInputSchema,
  myRentalsPageSize,
  nextChargeDate,
  rentalLines,
  weeksPaid,
  type RentalDetail,
  type RentalListItem,
  type RentalListPage,
} from "../lib/rentals";
import { getAsync, unwrap } from "./async";
import { requireUserId } from "./auth";
import { findOwnRental } from "./own-rental";

const rentalMessages = {
  failed_to_list_rentals: "We couldn't load your rentals. Try again in a moment.",
  failed_to_load_rental: "We couldn't load your rental. Try again in a moment.",
  rental_data_invalid: `We couldn't load your rental. Email ${supportEmail} and we'll sort it out.`,
  failed_to_list_payments: "We couldn't load your payments. Try again in a moment.",
  failed_to_load_billing_plan: "We couldn't load your weekly billing. Try again in a moment.",
  billing_plan_data_invalid: `We couldn't load your weekly billing. Email ${supportEmail} and we'll sort it out.`,
  failed_to_list_locations: "We couldn't load your rentals. Try again in a moment.",
};

interface RentalBilling {
  payments: Payment[];
  plan: BillingAgreement | null;
}

// A rental's charges and its Billing plan. A rental not paid yet has no plan.
const loadBilling = createServerOnlyFn(async (rental: Rental): Promise<RentalBilling> => {
  const async = getAsync();
  const [payments, plan] = await Promise.all([
    async.payment.listPayments({ rentalId: rental.id }),
    async.billing.getBillingPlan({ rentalId: rental.id }),
  ]);

  return {
    payments: unwrap(payments, rentalMessages),
    plan:
      !plan.success && plan.error.code === "billing_plan_not_found"
        ? null
        : unwrap(plan, rentalMessages),
  };
});

const loadLocations = createServerOnlyFn(async (): Promise<Location[]> =>
  unwrap(await getAsync().catalog.listLocations(), rentalMessages),
);

function toListItem(rental: Rental, billing: RentalBilling, locations: Location[]): RentalListItem {
  return {
    number: rental.number,
    status: rental.status,
    city: locations.find((location) => location.id === rental.locationId)?.name,
    lines: rentalLines(rental),
    currency: rental.currency,
    nextChargeDate: nextChargeDate(rental, billing.plan, billing.payments),
    weeksPaid: weeksPaid(billing.payments),
  };
}

// Everything the rental's page shows, without ids, internal notes or provider references.
function toDetail(rental: Rental, billing: RentalBilling, locations: Location[]): RentalDetail {
  const { contact, address } = rental;

  return {
    ...toListItem(rental, billing, locations),
    locationId: rental.locationId,
    startDate: rental.startDate,
    endDate: rental.endDate,
    deliveryDate: rental.deliveryDate ?? rental.startDate,
    deliveryWindow: rental.deliveryWindow,
    weeks: rentalWeekCount(rental.startDate, rental.endDate),
    delivered: rental.fulfillmentStatus === "delivered" || rental.fulfillmentStatus === "returned",
    contact: { name: contact.name, email: contact.email, whatsapp: contact.whatsapp },
    address: {
      line1: address.line1,
      line2: address.line2,
      area: address.area,
      city: address.city,
      postcode: address.postcode,
      deliveryNotes: address.deliveryNotes,
    },
    summary: rental.summary,
    payments: billing.payments.map((payment) => ({
      billingCycle: payment.billingCycle,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      at: payment.paidAt ?? payment.createdAt,
    })),
    billingPlan: billing.plan && {
      status: billing.plan.status,
      failedAttempts: billing.plan.failedAttempts,
    },
    placedAt: rental.createdAt,
    cancelledAt: rental.cancelledAt,
  };
}

/** A page of the signed-in customer's rentals, newest first. */
export const listMyRentals = createServerFn({ method: "GET" })
  .validator(myRentalsInputSchema)
  .handler(async ({ data }): Promise<RentalListPage> => {
    const userId = await requireUserId();

    const [listed, locations] = await Promise.all([
      getAsync().rental.listRentals({ userId, page: data.page, pageSize: myRentalsPageSize }),
      loadLocations(),
    ]);
    const page = unwrap(listed, rentalMessages);
    const items = await Promise.all(
      page.items.map(async (rental) => toListItem(rental, await loadBilling(rental), locations)),
    );

    return {
      items,
      page: data.page,
      pageCount: Math.max(1, Math.ceil(page.total / myRentalsPageSize)),
      total: page.total,
    };
  });

/**
 * One of the signed-in customer's rentals by its number, or `null` when it
 * doesn't exist or belongs to someone else, checked as checkout checks it.
 */
export const getMyRental = createServerFn({ method: "GET" })
  .validator(myRentalInputSchema)
  .handler(async ({ data }): Promise<RentalDetail | null> => {
    const userId = await requireUserId();

    const rental = await findOwnRental(userId, data.number, rentalMessages);
    if (!rental) return null;

    const [billing, locations] = await Promise.all([loadBilling(rental), loadLocations()]);
    return toDetail(rental, billing, locations);
  });
