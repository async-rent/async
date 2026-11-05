import { Badge } from "@async-rent/ui/components/badge";
import { Button } from "@async-rent/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@async-rent/ui/components/empty";
import { Field, FieldGroup, FieldTitle } from "@async-rent/ui/components/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@async-rent/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@async-rent/ui/components/select";
import { Separator } from "@async-rent/ui/components/separator";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { Spinner } from "@async-rent/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@async-rent/ui/components/toggle-group";
import { RiAddLine, RiArrowDownLine, RiCloseLine, RiFilter3Line } from "@remixicon/react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";

import { useCartActions } from "../../hooks/use-cart";
import { equipmentQueryOptions } from "../../hooks/use-equipment";
import { useRentalPlan } from "../../hooks/use-rental-plan";
import type { CategoryTile } from "../../lib/catalog-overview";
import {
  activeFilterCount,
  defaultEquipmentSort,
  equipmentPageSize,
  equipmentPriceCeilings,
  equipmentSortLabels,
  equipmentSortSchema,
  type EquipmentCard,
  type EquipmentFilters,
  type EquipmentSort,
} from "../../lib/equipment";
import { formatMoney } from "../../lib/money";
import { ProductImage } from "../product-image";

// The badge the catalog gives its best sellers; it gets the design's filled pill.
const mostRentedBadge = "most rented";

interface AllEquipmentProps {
  filters: EquipmentFilters;
  /** Categories the filter offers, as the category index shows them. */
  categories: CategoryTile[];
  onFiltersChange: (patch: Partial<EquipmentFilters>) => void;
}

/** "All equipment": the city's gear as cards, with sort, filters and "load more" paging. */
export function AllEquipment({ filters, categories, onFiltersChange }: AllEquipmentProps) {
  const { plan } = useRentalPlan();
  // Keep the old cards on screen while a new city, sort or filter loads.
  const query = useInfiniteQuery({
    ...equipmentQueryOptions(plan.locationId, filters),
    placeholderData: keepPreviousData,
  });

  const pages = query.data?.pages ?? [];
  const cards = pages.flatMap((page) => page.cards);
  const last = pages.at(-1);
  const total = last?.total ?? 0;
  // The city the cards were priced for, which trails a city switch until it loads.
  const currency = last?.currency ?? "USD";
  const remaining = Math.max(total - cards.length, 0);
  const narrowed = activeFilterCount(filters) > 0 || filters.q !== undefined;
  const heading = categories.find((category) => category.slug === filters.category)?.name;

  return (
    <section
      id="all-equipment"
      aria-labelledby="all-equipment-heading"
      className="mx-auto flex w-full max-w-360 scroll-mt-6 flex-col gap-6 px-5 pb-20 md:px-10 xl:px-20"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h2
            id="all-equipment-heading"
            className="font-heading text-3xl leading-[1.3] tracking-[-0.01em] text-ink"
          >
            {heading ?? "All equipment"}
          </h2>
          {filters.q && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Results for “{filters.q}”
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => onFiltersChange({ q: undefined })}
              >
                <RiCloseLine />
              </Button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SortPicker
            value={filters.sort ?? defaultEquipmentSort}
            onChange={(sort) =>
              onFiltersChange({ sort: sort === defaultEquipmentSort ? undefined : sort })
            }
          />
          <FiltersPopover
            filters={filters}
            categories={categories}
            onFiltersChange={onFiltersChange}
          />
        </div>
      </div>

      {query.isPending ? (
        <EquipmentGridSkeleton />
      ) : query.isError && cards.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="font-heading text-xl font-normal">
              We couldn't load the equipment
            </EmptyTitle>
            <EmptyDescription>Check your connection and try again.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => query.refetch()}>
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      ) : cards.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="font-heading text-xl font-normal">
              {narrowed ? "Nothing matches yet" : "No equipment here yet"}
            </EmptyTitle>
            <EmptyDescription>
              {narrowed
                ? "Try another search, or clear the filters to see everything we rent in this city."
                : "We're still stocking this city. Check back soon."}
            </EmptyDescription>
          </EmptyHeader>
          {narrowed && (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() =>
                  onFiltersChange({ q: undefined, category: undefined, maxPrice: undefined })
                }
              >
                Clear filters
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <ul
            aria-busy={query.isPlaceholderData}
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-y-10",
              query.isPlaceholderData && "opacity-60",
            )}
          >
            {cards.map((card) => (
              <li key={card.id}>
                <EquipmentCardView
                  card={card}
                  currency={currency}
                  // Old cards may be from the previous city; wait for this one's.
                  stale={query.isPlaceholderData}
                />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-center gap-5 pt-4">
            <p
              aria-live="polite"
              className="font-mono text-[9px] leading-3 tracking-[0.12em] text-muted-foreground uppercase"
            >
              Showing {cards.length} of {total}
            </p>
            {query.hasNextPage && (
              <>
                <Separator className="w-12" />
                <Button
                  variant="outline"
                  disabled={query.isFetchingNextPage}
                  onClick={() => query.fetchNextPage()}
                >
                  Load {Math.min(equipmentPageSize, remaining) || equipmentPageSize} more
                  {query.isFetchingNextPage ? (
                    <Spinner data-icon="inline-end" />
                  ) : (
                    <RiArrowDownLine data-icon="inline-end" />
                  )}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface EquipmentCardViewProps {
  card: EquipmentCard;
  currency: string;
  /** Shown while newer cards load; it cannot be added. */
  stale: boolean;
}

function EquipmentCardView({ card, currency, stale }: EquipmentCardViewProps) {
  const { addToCart, addingProductId } = useCartActions();
  const adding = addingProductId === card.id;
  const rentedOut = card.stock === 0;

  return (
    <article className="flex flex-col gap-3">
      <div className="relative">
        <ProductImage image={card.image} className="aspect-4/3 rounded-lg p-6 sm:p-8" />
        {card.badge && <CardBadge label={card.badge} />}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-4.5 font-semibold text-ink">{card.name}</h3>
        <p className="line-clamp-1 text-xs leading-4 text-muted-foreground">{card.summary}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-baseline gap-1">
          <span className="text-lg leading-6 font-semibold text-ink">
            {formatMoney(card.weeklyPrice, currency)}
          </span>
          <span className="font-mono text-[8px] leading-2.5 tracking-[0.06em] text-muted-foreground uppercase">
            / week
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={adding || rentedOut || stale}
          aria-label={rentedOut ? `${card.name} is rented out` : `Add ${card.name} to cart`}
          onClick={() => addToCart(card.id)}
        >
          {rentedOut ? "Rented out" : "Add"}
          {!rentedOut &&
            (adding ? <Spinner data-icon="inline-end" /> : <RiAddLine data-icon="inline-end" />)}
        </Button>
      </div>
    </article>
  );
}

function CardBadge({ label }: { label: string }) {
  const highlighted = label.trim().toLowerCase() === mostRentedBadge;

  return (
    <Badge variant={highlighted ? "default" : "outline"} className="absolute top-3 left-3">
      {label}
    </Badge>
  );
}

interface SortPickerProps {
  value: EquipmentSort;
  onChange: (sort: EquipmentSort) => void;
}

function SortPicker({ value, onChange }: SortPickerProps) {
  return (
    <Select
      items={equipmentSortLabels}
      value={value}
      onValueChange={(next) => {
        const parsed = equipmentSortSchema.safeParse(next);
        if (parsed.success) onChange(parsed.data);
      }}
    >
      <SelectTrigger aria-label="Sort equipment" size="sm">
        <span className="text-muted-foreground">Sort</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Sort by</SelectLabel>
          {equipmentSortSchema.options.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {equipmentSortLabels[sort]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

interface FiltersPopoverProps {
  filters: EquipmentFilters;
  categories: CategoryTile[];
  onFiltersChange: (patch: Partial<EquipmentFilters>) => void;
}

const anyValue = "any";

function FiltersPopover({ filters, categories, onFiltersChange }: FiltersPopoverProps) {
  const { location } = useRentalPlan();
  const count = activeFilterCount(filters);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <RiFilter3Line data-icon="inline-start" />
        Filters
        {count > 0 && (
          <>
            <Badge aria-hidden="true">{count}</Badge>
            <span className="sr-only">({count} active)</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Filters</PopoverTitle>
        </PopoverHeader>
        <FieldGroup>
          <FilterField
            id="filter-category"
            label="Category"
            value={filters.category ?? anyValue}
            options={[
              { value: anyValue, label: "All" },
              ...categories.map((category) => ({ value: category.slug, label: category.name })),
            ]}
            onChange={(value) =>
              onFiltersChange({ category: value === anyValue ? undefined : value })
            }
          />
          <FilterField
            id="filter-weekly-price"
            label="Weekly price"
            value={filters.maxPrice === undefined ? anyValue : String(filters.maxPrice)}
            options={[
              { value: anyValue, label: "Any" },
              ...equipmentPriceCeilings.map((ceiling) => ({
                value: String(ceiling),
                label: `Up to ${formatMoney(ceiling * 100, location.currency)}`,
              })),
            ]}
            onChange={(value) =>
              onFiltersChange({ maxPrice: value === anyValue ? undefined : Number(value) })
            }
          />
        </FieldGroup>
        {count > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFiltersChange({ category: undefined, maxPrice: undefined })}
          >
            Clear filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface FilterFieldProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterField({ id, label, value, options, onChange }: FilterFieldProps) {
  return (
    <Field>
      <FieldTitle id={id}>{label}</FieldTitle>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        size="sm"
        spacing={1}
        className="flex-wrap"
        value={[value]}
        // Pressing the chosen option again clears it back to "any".
        onValueChange={(next) => onChange(typeof next[0] === "string" ? next[0] : anyValue)}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

function EquipmentGridSkeleton() {
  return (
    <ul
      aria-busy="true"
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: 8 }, (_, card) => (
        <li key={card} className="flex flex-col gap-3">
          <Skeleton className="aspect-4/3 rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8" />
        </li>
      ))}
    </ul>
  );
}
