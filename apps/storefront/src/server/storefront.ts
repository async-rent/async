import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { parseStoredRentalPlan, rentalPlanCookie, resolveRentalPlan } from "../lib/rental-plan";
import { getAsync, unwrap } from "./async";

/**
 * The open cities Async delivers to and the visitor's rental plan, resolved
 * from their cookie against them.
 */
export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const async = getAsync();
  // Only open cities are offered; announced ones cannot take a cart yet.
  const locations = unwrap(await async.catalog.listLocations()).filter(
    async.catalog.isLocationActive,
  );

  const resolved = resolveRentalPlan({
    stored: parseStoredRentalPlan(getCookie(rentalPlanCookie)),
    locations,
    now: new Date(),
  });
  if (!resolved) throw new Error("No city is open for rentals yet");

  return { locations, plan: resolved.plan };
});
