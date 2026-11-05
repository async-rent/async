import { Skeleton } from "@async-rent/ui/components/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Bundles } from "../components/catalog/bundles";
import { CatalogHero } from "../components/catalog/catalog-hero";
import { CategoryIndex } from "../components/catalog/category-index";
import { catalogOverviewQueryOptions } from "../hooks/use-catalog-overview";
import { storefrontQueryOptions, useRentalPlan } from "../hooks/use-rental-plan";

// Bad values fall back to "no filter" rather than an error page.
const catalogSearchSchema = z.object({
  q: z.string().max(120).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: catalogSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    // "static" reuses whatever is cached, as the loader only needs the data present.
    const { plan } = await queryClient.query({ ...storefrontQueryOptions, staleTime: "static" });
    await queryClient.query({
      ...catalogOverviewQueryOptions(plan.locationId),
      staleTime: "static",
    });
  },
  component: CatalogPage,
});

function CatalogPage() {
  const { q, category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { plan } = useRentalPlan();
  // Keep the previous city's sections on screen while a new city loads.
  const { data: overview } = useQuery({
    ...catalogOverviewQueryOptions(plan.locationId),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <CatalogHero
        query={q}
        onSearch={(query) =>
          navigate({ search: (previous) => ({ ...previous, q: query || undefined }) })
        }
      />
      {overview ? (
        <>
          <CategoryIndex overview={overview} activeCategory={category} />
          <Bundles overview={overview} />
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
