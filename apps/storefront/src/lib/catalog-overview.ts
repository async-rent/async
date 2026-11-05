import {
  priceForLocation,
  type Category,
  type Image,
  type Location,
  type Product,
} from "@async-rent/core";

/** The category the ready-made setups live in; the bundles section shows it apart. */
export const setupsCategorySlug = "setups";

/** The spec on a setup that lists its parts, comma-separated by product name. */
const setupPartsSpecLabel = "Includes";

export interface CategoryTile {
  id: string;
  slug: string;
  name: string;
  /** Products in this category the city rents. */
  count: number;
  /** Cover photo of the category's first product, in featured order. */
  image?: Image;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  /** Product names of the parts, as the setup's "Includes" spec lists them. */
  parts: string[];
  weeklyPrice: number;
  /** Weekly saving against renting every part alone; set only when all parts are priced here. */
  weeklySaving?: number;
  image?: Image;
}

export interface CatalogOverview {
  currency: string;
  deliveryFee: number;
  /** Equipment (everything but setups) the city rents; the "See all" count. */
  equipmentCount: number;
  categories: CategoryTile[];
  bundles: Bundle[];
  /** One short line per product, for places that only hold a product id (the cart). */
  productSummaries: Record<string, string>;
}

export interface BuildCatalogOverviewInput {
  location: Location;
  categories: Category[];
  /** Every product the city rents, in featured order. */
  products: Product[];
}

/**
 * Derives the catalog page's category tiles and bundles from the catalog
 * service's categories and products for one city. Pure.
 */
export function buildCatalogOverview(input: BuildCatalogOverviewInput): CatalogOverview {
  const { location, categories } = input;

  const priced = input.products.flatMap((product) => {
    const price = priceForLocation(product, location.id);
    return price ? [{ product, weeklyPrice: price.weeklyPrice }] : [];
  });

  const setups = categories.find((category) => category.slug === setupsCategorySlug);

  const tiles = categories
    .filter((category) => category.id !== setups?.id)
    .map((category): CategoryTile => {
      const inCategory = priced.filter(({ product }) => product.categoryId === category.id);

      return {
        id: category.id,
        slug: category.slug,
        name: category.name,
        count: inCategory.length,
        image: inCategory[0]?.product.images[0],
      };
    });

  const weeklyPriceByName = new Map(
    priced.map(({ product, weeklyPrice }) => [product.name, weeklyPrice]),
  );

  const bundles = priced
    .filter(({ product }) => setups && product.categoryId === setups.id)
    .map(({ product, weeklyPrice }): Bundle => {
      const parts = setupParts(product);
      const partPrices = parts.map((name) => weeklyPriceByName.get(name));
      const partsTotal = partPrices.every((price) => price !== undefined)
        ? partPrices.reduce<number>((sum, price) => sum + (price ?? 0), 0)
        : undefined;
      const saving = partsTotal === undefined ? 0 : partsTotal - weeklyPrice;

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        parts,
        weeklyPrice,
        weeklySaving: parts.length > 0 && saving > 0 ? saving : undefined,
        image: product.images[0],
      };
    });

  return {
    currency: location.currency,
    deliveryFee: location.deliveryFee,
    equipmentCount: tiles.reduce((sum, tile) => sum + tile.count, 0),
    categories: tiles,
    bundles,
    productSummaries: Object.fromEntries(
      priced.map(({ product }) => [product.id, product.highlights[0] ?? product.tagline]),
    ),
  };
}

function setupParts(product: Product): string[] {
  const spec = product.specs.find((candidate) => candidate.label === setupPartsSpecLabel);
  if (!spec) return [];

  return spec.value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
