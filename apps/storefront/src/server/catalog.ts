import type { Product } from "@async-rent/core";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildCatalogOverview, setupsCategorySlug } from "../lib/catalog-overview";
import {
  defaultEquipmentSort,
  equipmentFiltersSchema,
  equipmentPageSize,
  equipmentScopeSchema,
  searchText,
  toEquipmentCard,
} from "../lib/equipment";
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

const equipmentPageInput = equipmentFiltersSchema.extend({
  locationId: z.string(),
  // Core serves pages 1 to 100.
  page: z.number().int().positive().max(100),
  // Only narrows the visitor's own results, so it is safe to take from the browser.
  scope: equipmentScopeSchema.optional(),
});

/**
 * One page of "All equipment" cards for a city. Without a category it shows
 * every category but the setups, which the bundles section already sells, so
 * its total matches the "See all" count.
 *
 * The first page looks up the city and category and returns them as `scope`;
 * passing that back skips the lookups on later pages.
 */
export const getEquipmentPage = createServerFn({ method: "GET" })
  .validator(equipmentPageInput)
  .handler(async ({ data }) => {
    const async = getAsync();
    const { locationId, page } = data;
    let { scope } = data;

    if (!scope) {
      const [locations, categories] = await Promise.all([
        async.catalog.listLocations(),
        async.catalog.listCategories(),
      ]);

      const location = unwrap(locations).find((candidate) => candidate.id === locationId);
      if (!location) throw new Error(`Location ${locationId} not found`);

      const allCategories = unwrap(categories);
      const category = data.category
        ? allCategories.find((candidate) => candidate.slug === data.category)
        : undefined;

      // A stale or mistyped category link matches nothing rather than everything.
      if (data.category && !category) {
        return {
          scope: { currency: location.currency },
          cards: [],
          total: 0,
          page,
          hasMore: false,
        };
      }

      const setups = allCategories.find((candidate) => candidate.slug === setupsCategorySlug);
      scope = {
        currency: location.currency,
        categoryId: category?.id,
        excludeCategoryIds: !category && setups ? [setups.id] : undefined,
      };
    }

    const found = unwrap(
      await async.catalog.searchProducts({
        q: searchText(data.q),
        categoryId: scope.categoryId,
        excludeCategoryIds: scope.excludeCategoryIds,
        locationId,
        // The URL holds whole units; core prices are minor units.
        maxWeeklyPrice: data.maxPrice === undefined ? undefined : data.maxPrice * 100,
        sort: data.sort ?? defaultEquipmentSort,
        page,
        pageSize: equipmentPageSize,
      }),
    );

    return {
      scope,
      cards: found.items.flatMap((product) => toEquipmentCard(product, locationId) ?? []),
      total: found.total,
      page,
      hasMore: found.hasMore,
    };
  });
