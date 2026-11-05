import { infiniteQueryOptions } from "@tanstack/react-query";

import type { EquipmentFilters } from "../lib/equipment";
import { getEquipmentPage } from "../server/catalog";

/** "All equipment" cards for one city and set of filters, a page at a time. */
export function equipmentQueryOptions(locationId: string, filters: EquipmentFilters) {
  const { q, category, sort, maxPrice } = filters;

  return infiniteQueryOptions({
    queryKey: ["equipment", locationId, { q, category, sort, maxPrice }],
    queryFn: ({ pageParam }) =>
      getEquipmentPage({ data: { locationId, q, category, sort, maxPrice, page: pageParam } }),
    initialPageParam: 1,
    // Core serves at most 100 pages.
    getNextPageParam: (last) => (last.hasMore && last.page < 100 ? last.page + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
}
