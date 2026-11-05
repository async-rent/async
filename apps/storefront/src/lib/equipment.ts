import { maxSearchTokens, priceForLocation, type Image, type Product } from "@async-rent/core";
import { z } from "zod";

/** Cards per page, and per "Load more". */
export const equipmentPageSize = 12;

/** The sorts the grid offers, in menu order. A subset of core's sorts. */
export const equipmentSortSchema = z.enum([
  "popular",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
]);

export type EquipmentSort = z.infer<typeof equipmentSortSchema>;

export const defaultEquipmentSort = equipmentSortSchema.enum.popular;

export const equipmentSortLabels = {
  popular: "Most rented",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  name_asc: "Name: A to Z",
} satisfies Record<EquipmentSort, string>;

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
 * Every card once, in first-seen order. Pages come by offset, so when the
 * order shifts between loads (a new rental moves a product up "Most rented")
 * a product can land on two pages.
 */
export function uniqueCards(cards: EquipmentCard[]): EquipmentCard[] {
  const seen = new Set<string>();

  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
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
