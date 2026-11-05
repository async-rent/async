import type { Cart } from "@async-rent/core";
import { useAuth } from "@clerk/tanstack-react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import type { CheckoutDetailsInput } from "../lib/checkout";
import { getCheckoutContact, placeOrder, startRentalPayment } from "../server/checkout";
import { useRentalPlan } from "./use-rental-plan";

/** The contact details the signed-in visitor's checkout form starts with. */
export function useCheckoutContact() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  return useQuery({
    queryKey: ["checkout-contact", userId ?? null],
    queryFn: () => getCheckoutContact(),
    enabled: isLoaded && isSignedIn === true,
    staleTime: 5 * 60 * 1000,
  });
}

/** An order placed on this visit, with the cart it was placed from. */
export interface PlacedOrder {
  number: string;
  cart: Cart;
}

interface CheckoutVariables {
  details: CheckoutDetailsInput;
  cart: Cart;
}

/**
 * Places the order and sends the visitor to PayPal. The order is placed once:
 * if PayPal then fails, another try only reopens the payment of the order
 * already placed, since its cart is gone and its stock is held.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  const { plan } = useRentalPlan();
  const place = useServerFn(placeOrder);
  const pay = useServerFn(startRentalPayment);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const checkout = useMutation({
    mutationFn: async ({ details, cart }: CheckoutVariables) => {
      let number = placed?.number;
      if (!number) {
        ({ number } = await place({
          data: {
            ...details,
            locationId: plan.locationId,
            deliveryDate: plan.deliveryDate,
            weeks: plan.weeks,
          },
        }));
        setPlaced({ number, cart });
        // Core emptied the cart, so the header and drawer should show it empty.
        void queryClient.invalidateQueries({ queryKey: ["cart"] });
      }

      return pay({ data: { number } });
    },
    // Leaving for PayPal, or for the confirmation when the order was already paid.
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  return {
    placed,
    submit: checkout.mutate,
    /** True from the click until the browser has left for PayPal. */
    isSubmitting: checkout.isPending || checkout.isSuccess,
    error: checkout.error,
  };
}
