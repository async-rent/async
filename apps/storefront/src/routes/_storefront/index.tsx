import { Skeleton } from "@async-rent/ui/components/skeleton";
import { isServer, keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AllEquipment } from "../../components/catalog/all-equipment";
import { Bundles } from "../../components/catalog/bundles";
import { CatalogHero } from "../../components/catalog/catalog-hero";
import { CategoryIndex } from "../../components/catalog/category-index";
import { catalogOverviewQueryOptions } from "../../hooks/use-catalog-overview";
import { equipmentQueryOptions } from "../../hooks/use-equipment";
import { storefrontQueryOptions, useRentalPlan } from "../../hooks/use-rental-plan";
import { equipmentFiltersSchema, type EquipmentFilters } from "../../lib/equipment";

// Bad values fall back to "no filter" rather than an error page.
const { shape } = equipmentFiltersSchema;
const catalogSearchSchema = z.object({
  q: shape.q.catch(undefined),
  category: shape.category.catch(undefined),
  sort: shape.sort.catch(undefined),
  maxPrice: shape.maxPrice.catch(undefined),
});

export const Route = createFileRoute("/_storefront/")({
  validateSearch: catalogSearchSchema,
  loaderDeps: ({ search: { q, category, sort, maxPrice } }) => ({ q, category, sort, maxPrice }),
  loader: async ({ context: { queryClient }, deps }) => {
    // "static" reuses whatever is cached, as the loader only needs the data present.
    const { plan } = await queryClient.query({ ...storefrontQueryOptions, staleTime: "static" });
    const equipment = queryClient
      .infiniteQuery({ ...equipmentQueryOptions(plan.locationId, deps), staleTime: "static" })
      // The grid shows its own error state; the page itself still renders.
      .catch(() => undefined);
    await queryClient.query({
      ...catalogOverviewQueryOptions(plan.locationId),
      staleTime: "static",
    });
    // Server-render the first page. In the browser a filter change navigates at
    // once and the grid shows the old cards until the new ones arrive.
    if (isServer) await equipment;
  },
  component: CatalogPage,
});

function CatalogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { plan } = useRentalPlan();
  // Keep the previous city's sections on screen while a new city loads.
  const { data: overview } = useQuery({
    ...catalogOverviewQueryOptions(plan.locationId),
    placeholderData: keepPreviousData,
  });

  // Filters live in the URL, so a filtered grid can be shared and survives a reload.
  const setFilters = (patch: Partial<EquipmentFilters>) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), resetScroll: false });

  return (
    <>
      <CatalogHero
        query={search.q}
        // Jump to the grid, where the results show.
        onSearch={(query) =>
          navigate({
            search: (previous) => ({ ...previous, q: query || undefined }),
            hash: "all-equipment",
          })
        }
      />
      {overview ? (
        <>
          <CategoryIndex overview={overview} activeCategory={search.category} />
          <Bundles overview={overview} />
          <AllEquipment
            filters={search}
            categories={overview.categories}
            onFiltersChange={setFilters}
          />
        </>
      ) : (
        <CatalogSectionsSkeleton />
      )}
    </>
  );
}

function CatalogSectionsSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-360 flex-col gap-6 px-5 pb-16 md:px-10 xl:px-20"
    >
      <Skeleton className="h-10 w-60" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((tile) => (
          <Skeleton key={tile} className="h-34" />
        ))}
      </div>
      <Skeleton className="h-120 rounded-xl" />
    </div>
  );
}
