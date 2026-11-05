import { useAuth } from "@clerk/tanstack-react-start";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import type { CheckoutDetailsInput } from "../lib/checkout";
import {
  getCheckoutContact,
  getOpenOrder,
  placeOrder,
  startRentalPayment,
} from "../server/checkout";
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

function openOrderQueryOptions(userId: string | null | undefined) {
  return queryOptions({
    queryKey: ["open-order", userId ?? null],
    queryFn: () => getOpenOrder(),
  });
}

/** The signed-in visitor's order that is placed but not paid yet, or `null`. */
export function useOpenOrder() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  return useQuery({
    ...openOrderQueryOptions(userId),
    enabled: isLoaded && isSignedIn === true,
  });
}

/** Which step of checkout failed: placing the order, or opening its payment. */
export class CheckoutError extends Error {
  constructor(
    readonly step: "place" | "pay",
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Something went wrong. Try again.", { cause });
  }
}

/**
 * Places the order and sends the visitor to PayPal. The order is placed once:
 * while it waits for payment, checkout shows it instead of the cart, and
 * another try only reopens its payment, since its cart is gone and its stock
 * is held. `openNumber` is that waiting order's number: with it, submitting
 * only pays it, which is also how a declined or cancelled payment is retried.
 */
export function useCheckout(openNumber: string | undefined) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const { plan } = useRentalPlan();
  const place = useServerFn(placeOrder);
  const pay = useServerFn(startRentalPayment);

  async function placeOnce(details: CheckoutDetailsInput): Promise<string> {
    const openOrderOptions = openOrderQueryOptions(userId);

    try {
      const { order } = await place({
        data: {
          ...details,
          locationId: plan.locationId,
          deliveryDate: plan.deliveryDate,
          weeks: plan.weeks,
        },
      });
      queryClient.setQueryData(openOrderOptions.queryKey, order);
      return order.number;
    } catch (error) {
      // The order may exist even though the reply was lost, or another tab may
      // have placed it: then carry on and pay that one.
      const found = await queryClient
        .fetchQuery({ ...openOrderOptions, staleTime: 0 })
        .catch(() => null);
      if (found) return found.number;

      throw new CheckoutError("place", error);
    } finally {
      // Core emptied the cart, so the header and drawer should show it empty.
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  }

  const checkout = useMutation({
    mutationFn: async (details: CheckoutDetailsInput | undefined) => {
      let number = openNumber;
      if (!number) {
        if (!details) throw new CheckoutError("place", new Error("Fill in your details first."));
        number = await placeOnce(details);
      }

      try {
        return await pay({ data: { number } });
      } catch (error) {
        throw new CheckoutError("pay", error);
      }
    },
    // Leaving for PayPal, or for the confirmation when the order was already paid.
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  // Coming back from PayPal with the browser's Back button can restore this
  // page as it was left, still "leaving". Start over, with the order reloaded.
  const { reset } = checkout;
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      reset();
      void queryClient.invalidateQueries({ queryKey: ["open-order"] });
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [reset, queryClient]);

  return {
    submit: checkout.mutate,
    /** True from the click until the browser has left for PayPal. */
    isSubmitting: checkout.isPending || checkout.isSuccess,
    error: checkout.error instanceof CheckoutError ? checkout.error : null,
  };
}
