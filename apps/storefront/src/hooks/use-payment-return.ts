import { useAuth } from "@clerk/tanstack-react-start";
import { skipToken, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { confirmRentalPayment, getOwnOrder } from "../server/checkout";

// Coming back with the browser's Back button can restore the page as it was
// left, from before another PayPal try changed where the order stands. Ask again.
function useRefetchOnRestore(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const [scope] = queryKey;

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void queryClient.invalidateQueries({ queryKey: [scope] });
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [queryClient, scope]);
}

/**
 * Confirms the payment the visitor just approved at PayPal and says where
 * their order stands. `token` is the PayPal order they approved, from the
 * return URL. It is a write, but one that returns the same outcome however
 * often it runs, so it is a query: it runs once on arrival, never in the
 * background, and "Check again" refetches it. A paid order empties the
 * header's cart and leaves checkout with nothing waiting.
 */
export function usePaymentConfirmation(number: string | undefined, token: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useServerFn(confirmRentalPayment);
  const queryKey = ["payment-confirmation", userId ?? null, number ?? null, token ?? null];

  useRefetchOnRestore(queryKey);

  return useQuery({
    queryKey,
    queryFn: number
      ? async () => {
          const result = await confirm({ data: { number, token } });
          if (result.outcome === "paid") {
            queryClient.setQueryData(["open-order", userId ?? null], null);
            void queryClient.invalidateQueries({ queryKey: ["cart"] });
          }
          return result;
        }
      : skipToken,
    enabled: isLoaded && isSignedIn === true,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** One of the signed-in visitor's orders by its number, and whether it still waits for payment. */
export function useOwnOrder(number: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const load = useServerFn(getOwnOrder);
  const queryKey = ["own-order", userId ?? null, number ?? null];

  useRefetchOnRestore(queryKey);

  return useQuery({
    queryKey,
    queryFn: number ? () => load({ data: { number } }) : skipToken,
    enabled: isLoaded && isSignedIn === true,
    retry: 1,
  });
}
