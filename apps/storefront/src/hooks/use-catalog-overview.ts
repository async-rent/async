import { queryOptions } from "@tanstack/react-query";

import { getCatalogOverview } from "../server/catalog";

/** Category tiles and bundles for one city. */
export function catalogOverviewQueryOptions(locationId: string) {
  return queryOptions({
    queryKey: ["catalog-overview", locationId],
    queryFn: () => getCatalogOverview({ data: { locationId } }),
    staleTime: 5 * 60 * 1000,
  });
}
