import { useAuth } from "@clerk/tanstack-react-start";
import { keepPreviousData, skipToken, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyRental, listMyRentals } from "../server/rentals";

/**
 * A page of the signed-in customer's rentals, newest first. Keyed by user, so
 * one account never sees another's cached list. The page on screen stays
 * while the next one loads.
 */
export function useMyRentals(page: number) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const list = useServerFn(listMyRentals);

  return useQuery({
    queryKey: ["my-rentals", userId ?? null, page],
    queryFn: () => list({ data: { page } }),
    enabled: isLoaded && isSignedIn === true,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

/** One of the signed-in customer's rentals by its number, or `null` when it isn't theirs. */
export function useMyRental(number: string | undefined) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const load = useServerFn(getMyRental);

  return useQuery({
    queryKey: ["my-rental", userId ?? null, number ?? null],
    queryFn: number ? () => load({ data: { number } }) : skipToken,
    enabled: isLoaded && isSignedIn === true,
    retry: 1,
  });
}
