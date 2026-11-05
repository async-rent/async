import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import {
  resolveRentalPlan,
  writeRentalPlanCookie,
  type RentalPlan,
  type RentalWeeks,
} from "../lib/rental-plan";
import { getStorefront } from "../server/storefront";

/**
 * Cities and the visitor's rental plan. The root route loads it once; after
 * that the browser owns the plan, so it never goes stale.
 */
export const storefrontQueryOptions = queryOptions({
  queryKey: ["storefront"],
  queryFn: () => getStorefront(),
  staleTime: Number.POSITIVE_INFINITY,
});

/**
 * The visitor's city, delivery date and rental length, shared by the header,
 * the hero search and the cart. Changes are saved to the plan cookie so the
 * next server render matches.
 */
export function useRentalPlan() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(storefrontQueryOptions);
  const { locations, plan } = data;

  const location = locations.find((candidate) => candidate.id === plan.locationId);
  if (!location) throw new Error(`Location ${plan.locationId} is not listed`);

  function update(changes: Partial<RentalPlan>) {
    // Re-resolving keeps the date valid when the city (and its time zone) changes.
    const resolved = resolveRentalPlan({
      stored: { ...plan, ...changes },
      locations,
      now: new Date(),
    });
    if (!resolved) return;

    writeRentalPlanCookie(resolved.plan);
    queryClient.setQueryData(storefrontQueryOptions.queryKey, { locations, plan: resolved.plan });
  }

  return {
    locations,
    location,
    plan,
    setLocationId: (locationId: string) => update({ locationId }),
    setDeliveryDate: (deliveryDate: string) => update({ deliveryDate }),
    setWeeks: (weeks: RentalWeeks) => update({ weeks }),
  };
}
