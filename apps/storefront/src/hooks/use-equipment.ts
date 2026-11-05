import { infiniteQueryOptions } from "@tanstack/react-query";

import type { EquipmentFilters, EquipmentPageParam } from "../lib/equipment";
import { getEquipmentPage } from "../server/catalog";

const firstPage: EquipmentPageParam = { page: 1 };

/** "All equipment" cards for one city and set of filters, a page at a time. */
export function equipmentQueryOptions(locationId: string, filters: EquipmentFilters) {
  const { q, category, sort, maxPrice } = filters;

  return infiniteQueryOptions({
    queryKey: ["equipment", locationId, { q, category, sort, maxPrice }],
    queryFn: ({ pageParam: { page, scope } }) =>
      getEquipmentPage({ data: { locationId, q, category, sort, maxPrice, page, scope } }),
    initialPageParam: firstPage,
    // Later pages reuse the city and category page 1 looked up. Core serves at most 100 pages.
    getNextPageParam: (last): EquipmentPageParam | undefined =>
      last.hasMore && last.page < 100 ? { page: last.page + 1, scope: last.scope } : undefined,
    staleTime: 5 * 60 * 1000,
  });
}
