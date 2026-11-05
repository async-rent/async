import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseStatus } from "@tanstack/react-start/server";

import { countryCodeOf } from "../lib/cities";
import {
  paymentReturnUrls,
  placeOrderInputSchema,
  rentalEndDate,
  startRentalPaymentInputSchema,
  type CheckoutContact,
} from "../lib/checkout";
import { earliestDeliveryDate } from "../lib/rental-plan";
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
 * Turns the visitor's cart in a city into a rental awaiting payment, delivered
 * on the chosen day and running the weeks they planned. Core empties the cart
 * and holds the stock, so a second submit is refused rather than renting twice.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .validator(placeOrderInputSchema)
  .handler(async ({ data }) => {
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
    if (data.deliveryDate < earliestDeliveryDate(location, new Date())) {
      setResponseStatus(400);
      throw new Error("That delivery day has passed. Pick another one.");
    }

    const [cart, user] = await Promise.all([
      async.cart.getCartByUserAndLocation({ userId, locationId: location.id }),
      loadClerkUser(userId),
    ]);

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
        termsAcceptedAt: new Date().toISOString(),
      }),
      createRentalMessages,
    );

    return { number: rental.number };
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
