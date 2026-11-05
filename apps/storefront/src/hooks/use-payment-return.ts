import { useAuth } from "@clerk/tanstack-react-start";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { confirmRentalPayment, getOwnOrder } from "../server/checkout";

/**
 * Confirms the payment the visitor just approved at PayPal and says where
 * their order stands. It is a write, but one that returns the same outcome
 * however often it runs, so it is a query: it runs once on arrival, never in
 * the background, and "Check again" refetches it. A paid order empties the
 * header's cart and leaves checkout with nothing waiting.
 */
export function usePaymentConfirmation(number: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useServerFn(confirmRentalPayment);

  return useQuery({
    queryKey: ["payment-confirmation", userId ?? null, number ?? null],
    queryFn: number
      ? async () => {
          const result = await confirm({ data: { number } });
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

  return useQuery({
    queryKey: ["own-order", userId ?? null, number ?? null],
    queryFn: number ? () => load({ data: { number } }) : skipToken,
    enabled: isLoaded && isSignedIn === true,
    retry: 1,
  });
}
