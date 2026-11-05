import type { Rental } from "@async-rent/core";
import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseStatus } from "@tanstack/react-start/server";

import { countryCodeOf } from "../lib/cities";
import {
  paymentReturnUrls,
  placeOrderInputSchema,
  rentalEndDate,
  rentalWeekCount,
  startRentalPaymentInputSchema,
  supportEmail,
  type CheckoutContact,
  type OpenOrder,
} from "../lib/checkout";
import { earliestDeliveryDate, latestDeliveryDate } from "../lib/rental-plan";
import { getAsync, unwrap } from "./async";
import { requireUserId } from "./auth";

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
    const async = getAsync();

    const rental = unwrap(
      await async.rental.getRentalByNumber({ number: data.number }),
      startPaymentMessages,
    );
    // Someone else's order reads as not found, so a guessed number reveals nothing.
    if (rental.userId !== userId) {
      setResponseStatus(404);
      throw new Error(startPaymentMessages.rental_not_found);
    }

    const urls = paymentReturnUrls(getRequestUrl().origin, rental.number);
    const started = unwrap(
      await async.payment.startPayment({ rentalId: rental.id, provider: "paypal", ...urls }),
      startPaymentMessages,
    );

    return { redirectUrl: started.status === "paid" ? urls.returnUrl : started.approvalUrl };
  });
