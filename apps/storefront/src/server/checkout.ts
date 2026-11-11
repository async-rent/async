import {
  billingCycleStartsAt,
  isBillingCycleInRental,
  type Payment,
  type Rental,
} from "@async-rent/core";
import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseStatus } from "@tanstack/react-start/server";

import { countryCodeOf } from "../lib/cities";
import {
  confirmRentalPaymentInputSchema,
  orderNumberInputSchema,
  paymentReturnUrls,
  placeOrderInputSchema,
  rentalEndDate,
  rentalWeekCount,
  startRentalPaymentInputSchema,
  supportEmail,
  type CheckoutContact,
  type OpenOrder,
  type OwnOrder,
  type PaidOrder,
  type PaymentReturn,
} from "../lib/checkout";
import { earliestDeliveryDate, latestDeliveryDate } from "../lib/rental-plan";
import { getAsync, unwrap } from "./async";
import { requireUserId } from "./auth";
import { loadOwnRental } from "./own-rental";

// Core's messages for these name cart, product and location ids.
const createRentalMessages = {
  cart_not_found: "Your cart is empty. Add something to rent first.",
  cart_is_empty: "Your cart is empty. Add something to rent first.",
  product_out_of_stock:
    "Something in your cart just ran out in this city. Check your cart and try again.",
  location_not_available: "This city isn't open for rentals yet.",
  invalid_rental_period: "Pick a delivery day from the options shown.",
};

const startPaymentMessages = {
  provider_not_configured: "PayPal isn't available right now. Try again in a few minutes.",
  provider_request_failed: "We couldn't reach PayPal. Try again in a moment.",
  rental_not_found: "We couldn't find that order.",
  rental_not_payable: "This order is already paid or was cancelled.",
  payment_already_started: "This order's payment is already going through.",
  payment_pending: "PayPal is still processing an earlier payment for this order.",
  payment_replaced: "A newer PayPal payment is open for this order.",
};

const listRentalsMessages = {
  failed_to_list_rentals: "We couldn't load your orders. Try again in a moment.",
};

const loadOrderMessages = {
  rental_not_found: "We couldn't find that order.",
  failed_to_load_rental: "We couldn't load your order. Try again in a moment.",
  rental_data_invalid: `We couldn't load your order. Email ${supportEmail} and we'll sort it out.`,
};

// Codes the return page shows as a state of its own (held, replaced) are not here.
const confirmPaymentMessages = {
  ...loadOrderMessages,
  failed_to_list_payments: "We couldn't load your payment. Try again in a moment.",
  provider_not_configured:
    "We couldn't reach PayPal to confirm your payment. Try again in a few minutes.",
  provider_request_failed:
    "We couldn't reach PayPal to confirm your payment. Try again in a moment.",
  payment_not_found: "We couldn't find a payment for this order.",
  failed_to_load_payment: "We couldn't load your payment. Try again in a moment.",
  failed_to_save_payment: "We couldn't save your payment. Try again in a moment.",
  payment_data_invalid: `Something is off with this payment. Email ${supportEmail} and we'll sort it out.`,
  payment_captured_twice: `PayPal charged this order twice. Email ${supportEmail} and we'll refund the extra payment.`,
};

// The Clerk user, or `null` if Clerk can't be reached: the form then starts
// empty rather than the page failing.
const loadClerkUser = createServerOnlyFn(async (userId: string) => {
  try {
    return await clerkClient().users.getUser(userId);
  } catch (error) {
    console.error(error);
    return null;
  }
});

// What the browser sees of a placed order: no ids, internal notes or names.
function toOpenOrder(rental: Rental): OpenOrder {
  return {
    number: rental.number,
    locationId: rental.locationId,
    deliveryDate: rental.deliveryDate ?? rental.startDate,
    weeks: rentalWeekCount(rental.startDate, rental.endDate),
    currency: rental.currency,
    lines: rental.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      quantity: item.quantity,
      weeklyPrice: item.weeklyPrice,
    })),
    leftOut: 0,
    summary: rental.summary,
    details: {
      email: rental.contact.email,
      whatsapp: rental.contact.whatsapp ?? "",
      line1: rental.address.line1,
      city: rental.address.city,
      postcode: rental.address.postcode,
    },
  };
}

// The PayPal adapter's decline reasons speak of "the customer"; the shopper reads them as "you".
const declineReasons: Partial<Record<string, string>> = {
  "PayPal needs the customer to approve the payment again.":
    "PayPal needs you to approve the payment again.",
  "The customer cannot pay for this order with PayPal.":
    "PayPal can't take this payment from your account.",
  "The customer's PayPal account is restricted.": "Your PayPal account is restricted.",
  "The customer's PayPal account is locked or closed.": "Your PayPal account is locked or closed.",
};

function declineReason(payment: Payment): string {
  const reason = payment.failureReason;
  if (!reason) return "PayPal declined the payment.";
  return declineReasons[reason] ?? reason;
}

const weekMs = 7 * 24 * 60 * 60 * 1000;

// The first week after the one paid at checkout that starts today or later. Pure.
function upcomingBillingCycle(startDate: string, today: string): number {
  const elapsed = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.max(2, Math.ceil(elapsed / weekMs) + 1);
}

// A paid order with what its payment took and when the next week is billed.
// The confirmation can be opened again weeks later, so the next charge is the
// next one from today, not the second week.
function toPaidOrder(rental: Rental, payment: Payment, now = new Date()): PaidOrder {
  const order = toOpenOrder(rental);
  const cycle = upcomingBillingCycle(rental.startDate, now.toISOString().slice(0, 10));
  const billed = rental.status !== "completed" && isBillingCycleInRental(rental, cycle);

  return {
    ...order,
    paid: payment.amount,
    paidAt: payment.paidAt ?? payment.updatedAt ?? payment.createdAt,
    delivered: rental.fulfillmentStatus === "delivered" || rental.fulfillmentStatus === "returned",
    nextChargeDate: billed
      ? billingCycleStartsAt(rental.startDate, cycle).toISOString().slice(0, 10)
      : null,
    chargesLeft: billed && order.weeks !== null ? order.weeks - cycle + 1 : null,
  };
}

// The visitor's newest order still waiting for its first payment.
const findOpenRental = createServerOnlyFn(async (userId: string): Promise<Rental | undefined> => {
  const listed = unwrap(
    await getAsync().rental.listRentals({
      userId,
      status: "pending_payment",
      page: 1,
      pageSize: 1,
    }),
    listRentalsMessages,
  );
  return listed.items[0];
});

/**
 * The contact details a signed-in visitor's checkout starts with: the ones
 * they gave on their last rental, else their account's email and phone.
 * `null` while signed out.
 */
export const getCheckoutContact = createServerFn({ method: "GET" }).handler(
  async (): Promise<CheckoutContact | null> => {
    const { userId } = await auth();
    if (!userId) return null;

    const [rentals, user] = await Promise.all([
      getAsync().rental.listRentals({ userId, page: 1, pageSize: 1 }),
      loadClerkUser(userId),
    ]);
    const last = rentals.success ? rentals.data.items[0]?.contact : undefined;

    return {
      email: last?.email ?? user?.primaryEmailAddress?.emailAddress ?? "",
      whatsapp: last?.whatsapp ?? user?.primaryPhoneNumber?.phoneNumber ?? "",
    };
  },
);

/**
 * The visitor's order that is placed but not paid yet, or `null`. Checkout
 * shows it instead of the cart, so it can be paid after a reload, a trip back
 * from PayPal or a lost reply.
 */
export const getOpenOrder = createServerFn({ method: "GET" }).handler(
  async (): Promise<OpenOrder | null> => {
    const { userId } = await auth();
    if (!userId) return null;

    const rental = await findOpenRental(userId);
    return rental ? toOpenOrder(rental) : null;
  },
);

/**
 * Turns the visitor's cart in a city into a rental awaiting payment, delivered
 * on the chosen day and running the weeks they planned. Core empties the cart
 * and holds the stock, so a second submit is refused rather than renting twice.
 * A visitor has one unpaid order at a time: nothing releases an unpaid
 * order's stock yet, so more would let one account empty a city's shelves.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .validator(placeOrderInputSchema)
  .handler(async ({ data }): Promise<{ order: OpenOrder }> => {
    const userId = await requireUserId();
    const async = getAsync();

    const location = unwrap(await async.catalog.listLocations()).find(
      (candidate) => candidate.id === data.locationId,
    );
    const countryCode = location && countryCodeOf(location);
    if (!location || !countryCode || !async.catalog.isLocationActive(location)) {
      setResponseStatus(400);
      throw new Error(createRentalMessages.location_not_available);
    }

    // Gear arrives within 24 hours at the soonest. ISO dates compare as strings.
    const now = new Date();
    if (data.deliveryDate < earliestDeliveryDate(location, now)) {
      setResponseStatus(400);
      throw new Error("That delivery day has passed. Pick another one.");
    }
    if (data.deliveryDate > latestDeliveryDate(location, now)) {
      setResponseStatus(400);
      throw new Error("That delivery day is too far ahead. Pick an earlier one.");
    }

    const [open, cart, user] = await Promise.all([
      findOpenRental(userId),
      async.cart.getCartByUserAndLocation({ userId, locationId: location.id }),
      loadClerkUser(userId),
    ]);
    if (open) {
      setResponseStatus(409);
      throw new Error(
        `Order ${open.number} is still waiting for payment. Pay for it first, or email ${supportEmail} to change it.`,
      );
    }

    const rental = unwrap(
      await async.rental.createRental({
        cartId: unwrap(cart).id,
        contact: {
          // The form asks for no name, so the account's stands in.
          name: user?.fullName?.trim() || data.email,
          email: data.email,
          whatsapp: data.whatsapp,
        },
        address: {
          line1: data.line1,
          city: data.city,
          postcode: data.postcode,
          countryCode,
        },
        startDate: data.deliveryDate,
        endDate: rentalEndDate(data.deliveryDate, data.weeks),
        deliveryDate: data.deliveryDate,
        // Placing the order is agreeing to the terms the form states.
        termsAcceptedAt: now.toISOString(),
      }),
      createRentalMessages,
    );

    return { order: toOpenOrder(rental) };
  });

/**
 * Opens the PayPal payment for one of the visitor's own orders and returns
 * where to send them: PayPal's approval page, or straight to the confirmation
 * when an approval they gave earlier already paid it. Calling it again after
 * a failure opens a fresh PayPal order.
 */
export const startRentalPayment = createServerFn({ method: "POST" })
  .validator(startRentalPaymentInputSchema)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const rental = await loadOwnRental(userId, data.number, startPaymentMessages);

    const urls = paymentReturnUrls(getRequestUrl().origin, rental.number);
    const started = unwrap(
      await getAsync().payment.startPayment({ rentalId: rental.id, provider: "paypal", ...urls }),
      startPaymentMessages,
    );

    return { redirectUrl: started.status === "paid" ? urls.returnUrl : started.approvalUrl };
  });

/**
 * Takes the payment for one of the visitor's orders once they are back from
 * approving it at PayPal, and says where the order stands. It confirms the
 * order the rental's checkout payment points at, which is the PayPal order
 * last opened for it. The `token` PayPal adds to the URL never picks the
 * order: it only has to match, so an approval of an order since replaced
 * (another tab, an older PayPal window) never captures the newer one, which
 * would record it as declined. Calling it again returns the same outcome
 * without charging twice.
 */
export const confirmRentalPayment = createServerFn({ method: "POST" })
  .validator(confirmRentalPaymentInputSchema)
  .handler(async ({ data }): Promise<PaymentReturn> => {
    const userId = await requireUserId();
    const async = getAsync();

    const rental = await loadOwnRental(userId, data.number, confirmPaymentMessages);
    const { number } = rental;
    // Capturing now would take money for an order that will never be delivered.
    if (rental.status === "cancelled") return { outcome: "cancelled", number };

    const payments = unwrap(
      await async.payment.listPayments({ rentalId: rental.id }),
      confirmPaymentMessages,
    );
    const checkoutPayment = payments.find((payment) => payment.billingCycle === 1);
    if (!checkoutPayment) {
      // Only an order still waiting can lack one; a paid order whose payment
      // no longer reads back is a fault, not a payment to start.
      if (rental.status !== "pending_payment") {
        console.error(`Rental ${number} is ${rental.status} without a readable checkout payment`);
        throw new Error(confirmPaymentMessages.payment_data_invalid);
      }
      return { outcome: "unfinished", order: toOpenOrder(rental) };
    }
    // A settled payment only reads back its outcome. An open one is captured
    // only when PayPal says the visitor approved this very order.
    if (checkoutPayment.status === "pending" && data.token !== checkoutPayment.externalOrderId) {
      return { outcome: "unfinished", order: toOpenOrder(rental) };
    }

    const confirmed = await async.payment.confirmPayment({
      provider: checkoutPayment.provider,
      externalOrderId: checkoutPayment.externalOrderId,
      rentalId: rental.id,
    });
    if (!confirmed.success) {
      if (confirmed.error.code === "payment_pending") return { outcome: "processing", number };
      // Neither took money, so the order is still there to pay.
      if (
        confirmed.error.code === "payment_replaced" ||
        confirmed.error.code === "payment_not_approved"
      ) {
        return { outcome: "unfinished", order: toOpenOrder(rental) };
      }
    }

    const payment = unwrap(confirmed, confirmPaymentMessages);
    switch (payment.status) {
      case "succeeded":
        return { outcome: "paid", order: toPaidOrder(rental, payment) };
      case "failed":
        return {
          outcome: "declined",
          order: toOpenOrder(rental),
          reason: declineReason(payment),
        };
      case "refunded":
        return { outcome: "refunded", number };
      default:
        return { outcome: "processing", number };
    }
  });

/**
 * One of the visitor's own orders by its number, and whether it is still
 * waiting for its first payment. Read only, so the page PayPal sends
 * cancelled payments to can show the order without touching its payment.
 */
export const getOwnOrder = createServerFn({ method: "GET" })
  .validator(orderNumberInputSchema)
  .handler(async ({ data }): Promise<OwnOrder> => {
    const userId = await requireUserId();
    const rental = await loadOwnRental(userId, data.number, loadOrderMessages);

    const status =
      rental.status === "pending_payment"
        ? "awaiting_payment"
        : rental.status === "cancelled"
          ? "cancelled"
          : "paid";

    return { status, order: toOpenOrder(rental) };
  });
