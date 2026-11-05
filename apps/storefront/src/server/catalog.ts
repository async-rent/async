import type { Product } from "@async-rent/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildCatalogOverview } from "../lib/catalog-overview";
import { getAsync, unwrap } from "./async";

const catalogOverviewInput = z.object({ locationId: z.string() });

// The largest page core serves.
const pageSize = 48;

/**
 * Category tiles (with counts) and bundles for one city. Reads every product
 * the city rents, a page at a time, so counts and bundle savings come from the
 * same snapshot of the catalog.
 */
export const getCatalogOverview = createServerFn({ method: "GET" })
  .validator(catalogOverviewInput)
  .handler(async ({ data }) => {
    const async = getAsync();

    const [locations, categories] = await Promise.all([
      async.catalog.listLocations(),
      async.catalog.listCategories(),
    ]);

    const location = unwrap(locations).find((candidate) => candidate.id === data.locationId);
    if (!location) throw new Error(`Location ${data.locationId} not found`);

    const products: Product[] = [];
    for (let page = 1; ; page += 1) {
      const found = unwrap(
        await async.catalog.searchProducts({
          locationId: location.id,
          sort: "featured",
          page,
          pageSize,
        }),
      );
      products.push(...found.items);
      if (!found.hasMore) break;
    }

    return buildCatalogOverview({ location, categories: unwrap(categories), products });
  });
