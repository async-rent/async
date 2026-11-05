import { maxSearchTokens, priceForLocation, type Image, type Product } from "@async-rent/core";
import { z } from "zod";

/** Cards per page, and per "Load more". */
export const equipmentPageSize = 12;

/** The sorts the grid offers, in menu order. The first is the default. */
export const equipmentSorts = [
  { value: "popular", label: "Most rented" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A to Z" },
] as const;

export type EquipmentSort = (typeof equipmentSorts)[number]["value"];

export const defaultEquipmentSort: EquipmentSort = "popular";

export const equipmentSortSchema = z.enum(
  equipmentSorts.map((sort) => sort.value) as [EquipmentSort, ...EquipmentSort[]],
);

/** Weekly price ceilings the filter offers, in whole currency units. */
export const equipmentPriceCeilings = [5, 10, 20] as const;

/** What narrows the grid, as the catalog page's URL holds it. */
export const equipmentFiltersSchema = z.object({
  q: z.string().max(120).optional(),
  /** Category slug; the grid shows every category but setups without one. */
  category: z.string().max(64).optional(),
  sort: equipmentSortSchema.optional(),
  /** Highest weekly price, in whole currency units. */
  maxPrice: z.number().int().positive().max(100_000).optional(),
});

export type EquipmentFilters = z.infer<typeof equipmentFiltersSchema>;

/** Everything one product card shows, priced for one city. */
export interface EquipmentCard {
  id: string;
  slug: string;
  name: string;
  /** The short line under the name. */
  summary: string;
  badge?: string;
  image?: Image;
  weeklyPrice: number;
  /** Units the city can still rent; unknown when unset. */
  stock?: number;
}

export interface EquipmentPage {
  currency: string;
  cards: EquipmentCard[];
  /** Matching products across every page. */
  total: number;
  page: number;
  hasMore: boolean;
}

/** The one-line summary a product shows on cards and cart lines. */
export function productSummary(product: Product): string {
  return product.highlights[0] ?? product.tagline;
}

/** A product as a card in one city, or `undefined` when the city does not rent it. */
export function toEquipmentCard(product: Product, locationId: string): EquipmentCard | undefined {
  const price = priceForLocation(product, locationId);
  if (!price) return undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    summary: productSummary(product),
    badge: product.badge,
    image: product.images[0],
    weeklyPrice: price.weeklyPrice,
    stock: price.stock,
  };
}

/**
 * The search text core accepts: at most `maxSearchTokens` words. The hero
 * writes any text to the URL, so extra words are dropped rather than failing
 * the whole grid.
 */
export function searchText(q: string | undefined): string | undefined {
  const words = (q ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length > 0 ? words.slice(0, maxSearchTokens).join(" ") : undefined;
}

/** Filters the visitor chose, not counting search text or sort: the Filters button's count. */
export function activeFilterCount(filters: EquipmentFilters): number {
  return [filters.category, filters.maxPrice].filter((value) => value !== undefined).length;
}
