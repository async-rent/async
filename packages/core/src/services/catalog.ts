import type {
  CategoryRow,
  LocationRow,
  ProductHighlightRow,
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductSpecRow,
} from "@async-rent/db";
import {
  categories,
  locations,
  productHighlights,
  productImages,
  productPrices,
  productSpecs,
  products,
} from "@async-rent/db";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import type { Category, Location, Product, ProductQuery, ProductSort } from "../types";
import { categorySchema, locationSchema, productPageSchema, productSchema } from "../types";
import { createResult } from "../utils";

export interface CreateCatalogServiceOptions {
  db: DrizzleD1Database;
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

/** True when the city has a price for the product, so it can be rented there. */
const rentedIn = (locationId: string): SQL => sql`exists (
  select 1 from ${productPrices}
  where ${productPrices.productId} = ${products.id}
    and ${productPrices.locationId} = ${locationId}
)`;

/** True when at least one city has a price for the product. */
const rentedAnywhere: SQL = sql`exists (
  select 1 from ${productPrices}
  where ${productPrices.productId} = ${products.id}
)`;

/**
 * Splits a search into lowercase words. SQLite's `lower()` only handles ASCII
 * (D1 has no ICU), so the words are lowercased the same way: ASCII letters
 * match in any case, other letters must match exactly.
 */
function searchWords(q: string | undefined): string[] {
  return (q ?? "")
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * True when the word is in something a customer can see: the product's own
 * text or its category name. So "lighting" finds lamps even when no lamp
 * has "light" in its name.
 */
function matchesWord(word: string): SQL {
  const has = (column: AnySQLiteColumn) => sql`instr(lower(${column}), ${word}) > 0`;

  return sql`(
    ${has(products.name)}
    or ${has(products.tagline)}
    or ${has(products.description)}
    or exists (
      select 1 from ${categories}
      where ${categories.id} = ${products.categoryId}
        and ${has(categories.name)}
    )
  )`;
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The weekly price to sort by. In a city, that city's price. Without a city,
 * the lowest price anywhere.
 */
function sortPrice(locationId: string | undefined): SQL {
  if (locationId) {
    return sql`(
      select ${productPrices.weeklyPrice}
      from ${productPrices}
      where ${productPrices.productId} = ${products.id}
        and ${productPrices.locationId} = ${locationId}
    )`;
  }

  return sql`(
    select min(${productPrices.weeklyPrice})
    from ${productPrices}
    where ${productPrices.productId} = ${products.id}
  )`;
}

/** Every order ends with name and id, so equal rows keep the same order. */
function orderBy(sort: ProductSort, locationId: string | undefined): SQL[] {
  const byName = [asc(products.name), asc(products.id)];
  const price = sortPrice(locationId);

  switch (sort) {
    case "price_asc":
      return [asc(price), ...byName];
    case "price_desc":
      return [desc(price), ...byName];
    case "name_asc":
      return byName;
    case "newest":
      return [desc(products.createdAt), asc(products.id)];
    case "featured":
      return [desc(products.featured), ...byName];
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                    */
/* -------------------------------------------------------------------------- */

function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    timezone: row.timezone,
    description: row.description ?? undefined,
    currency: row.currency,
    deliveryFee: row.deliveryFee,
    status: row.status,
  };
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    sortOrder: row.sortOrder,
  };
}

interface ProductParts {
  category: CategoryRow;
  images: ProductImageRow[];
  highlights: ProductHighlightRow[];
  specs: ProductSpecRow[];
  prices: ProductPriceRow[];
}

/** Builds the product from its row and the rows that belong to it. */
function toProduct(row: ProductRow, parts: ProductParts): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    categoryId: parts.category.id,
    images: parts.images.map((image) => ({ url: image.url, alt: image.alt ?? undefined })),
    prices: parts.prices.map((price) => ({
      locationId: price.locationId,
      weeklyPrice: price.weeklyPrice,
      deposit: price.deposit ?? undefined,
      stock: price.stock ?? undefined,
    })),
    highlights: parts.highlights.map((highlight) => highlight.value),
    specs: parts.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    badge: row.badge ?? undefined,
    featured: row.featured,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

/** Groups rows by the product they belong to. */
function byProduct<TRow extends { productId: string }>(rows: TRow[]): Map<string, TRow[]> {
  return rows.reduce((groups, row) => {
    groups.set(row.productId, [...(groups.get(row.productId) ?? []), row]);

    return groups;
  }, new Map<string, TRow[]>());
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export function createCatalogService({ db }: CreateCatalogServiceOptions) {
  const searchProductsResult = createResult(
    productPageSchema,
    z.enum(["failed_to_search_products"]),
  );

  const getProductResult = createResult(
    productSchema,
    z.enum(["product_not_found", "failed_to_fetch_product", "product_data_invalid"]),
  );

  const listLocationsResult = createResult(
    z.array(locationSchema),
    z.enum(["failed_to_list_locations"]),
  );

  const listCategoriesResult = createResult(
    z.array(categorySchema),
    z.enum(["failed_to_list_categories"]),
  );

  /**
   * Turns product rows into full products. The images, highlights, specs and
   * prices of every product are read in one batch, so a page costs the same
   * number of queries whether it has one product or fifty.
   *
   * A product that does not fit the product schema is left out instead of
   * failing the whole read.
   */
  async function withDetails(rows: ProductRow[]): Promise<Product[]> {
    if (rows.length === 0) return [];

    const productIds = rows.map((row) => row.id);
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];

    const [categoryRows, imageRows, highlightRows, specRows, priceRows] = await db.batch([
      db.select().from(categories).where(inArray(categories.id, categoryIds)),
      db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.productId), asc(productImages.position)),
      db
        .select()
        .from(productHighlights)
        .where(inArray(productHighlights.productId, productIds))
        .orderBy(asc(productHighlights.productId), asc(productHighlights.position)),
      db
        .select()
        .from(productSpecs)
        .where(inArray(productSpecs.productId, productIds))
        .orderBy(asc(productSpecs.productId), asc(productSpecs.position)),
      db
        .select()
        .from(productPrices)
        .where(inArray(productPrices.productId, productIds))
        .orderBy(asc(productPrices.productId), asc(productPrices.locationId)),
    ]);

    const categoryById = new Map(categoryRows.map((row) => [row.id, row]));
    const imagesOf = byProduct(imageRows);
    const highlightsOf = byProduct(highlightRows);
    const specsOf = byProduct(specRows);
    const pricesOf = byProduct(priceRows);

    return rows.flatMap((row) => {
      const category = categoryById.get(row.categoryId);
      if (!category) return [];

      const product = toProduct(row, {
        category,
        images: imagesOf.get(row.id) ?? [],
        highlights: highlightsOf.get(row.id) ?? [],
        specs: specsOf.get(row.id) ?? [],
        prices: pricesOf.get(row.id) ?? [],
      });

      return productSchema.safeParse(product).success ? [product] : [];
    });
  }

  /** Only active products that some city rents, narrowed by the query. */
  async function searchProducts(
    query: ProductQuery,
  ): Promise<z.infer<(typeof searchProductsResult)["schema"]>> {
    const { success, failed } = searchProductsResult;
    const { q, categoryId, locationId, sort, page, pageSize } = query;

    const where = and(
      eq(products.status, "active"),
      rentedAnywhere,
      categoryId ? eq(products.categoryId, categoryId) : undefined,
      locationId ? rentedIn(locationId) : undefined,
      ...searchWords(q).map(matchesWord),
    );

    const batch = await db
      .batch([
        db.select({ total: count() }).from(products).where(where),
        db
          .select()
          .from(products)
          .where(where)
          .orderBy(...orderBy(sort, locationId))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_search_products", "Failed to search products");

    const [[counted], rows] = batch;
    const total = counted?.total ?? 0;

    const items = await withDetails(rows).catch(() => null);
    if (!items) return failed("failed_to_search_products", "Failed to search products");

    return success({ items, total, hasMore: page * pageSize < total });
  }

  /** One active product by a key. Archived products are hidden, as in search. */
  async function findProduct(
    condition: SQL,
    key: string,
  ): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    const { success, failed } = getProductResult;

    const rows = await db
      .select()
      .from(products)
      .where(and(condition, eq(products.status, "active")))
      .limit(1)
      .catch(() => null);
    if (!rows) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [row] = rows;
    if (!row) return failed("product_not_found", `Product ${key} not found`);

    const found = await withDetails([row]).catch(() => null);
    if (!found) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [product] = found;
    if (!product) return failed("product_data_invalid", `Product ${key} has invalid data`);

    return success(product);
  }

  /** For agents and API callers, who hold ids. */
  function getProductById(
    productId: string,
  ): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    return findProduct(eq(products.id, productId), productId);
  }

  /** For storefront routes, where the slug is the URL-safe id. */
  function getProductBySlug(slug: string): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    return findProduct(eq(products.slug, slug), slug);
  }

  async function listLocations(): Promise<z.infer<(typeof listLocationsResult)["schema"]>> {
    const { success, failed } = listLocationsResult;

    const rows = await db
      .select()
      .from(locations)
      .orderBy(asc(locations.name), asc(locations.id))
      .catch(() => null);
    if (!rows) return failed("failed_to_list_locations", "Failed to list locations");

    return success(rows.map(toLocation));
  }

  async function listCategories(): Promise<z.infer<(typeof listCategoriesResult)["schema"]>> {
    const { success, failed } = listCategoriesResult;

    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id))
      .catch(() => null);
    if (!rows) return failed("failed_to_list_categories", "Failed to list categories");

    return success(rows.map(toCategory));
  }

  return {
    searchProducts,
    getProductById,
    getProductBySlug,
    listLocations,
    listCategories,
  };
}
