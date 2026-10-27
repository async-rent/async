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
import { DrizzleD1Database } from "drizzle-orm/d1";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import type { Category, Location, Product, ProductSort } from "../types";
import {
  categorySchema,
  locationSchema,
  productPageSchema,
  productSchema,
  type ProductQuery,
} from "../types";
import { createResult } from "../utils";

export interface CreateCatalogServiceOptions {
  db: DrizzleD1Database;
}

/**
 * The fold SQLite applies on the SQL side of the search: `lower()` folds ASCII
 * letters only (D1 ships without ICU), so the token is folded the same way.
 * ASCII searches are case-insensitive; any other character must match the
 * stored case exactly.
 */
function foldToken(token: string): string {
  return token.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * Searches the text a customer can see: the product's own copy and the name of
 * the category it sits in, so "lighting" finds the lamps even though no lamp
 * calls itself a light in its name.
 */
function searchTokenCondition(token: string): SQL {
  const inText = (column: AnySQLiteColumn) => sql`instr(lower(${column}), ${token}) > 0`;

  return sql`(
    ${inText(products.name)}
    or ${inText(products.tagline)}
    or ${inText(products.description)}
    or exists (
      select 1 from ${categories}
      where ${categories.id} = ${products.categoryId}
        and instr(lower(${categories.name}), ${token}) > 0
    )
  )`;
}

/** A product only appears in the catalog when it can be rented somewhere. */
const pricedSomewhere = sql`exists (
  select 1 from ${productPrices}
  where ${productPrices.productId} = ${products.id}
)`;

function pricedIn(locationId: string): SQL {
  return sql`exists (
    select 1 from ${productPrices}
    where ${productPrices.productId} = ${products.id}
      and ${productPrices.locationId} = ${locationId}
  )`;
}

/**
 * The price a sort compares. With a city selected that city's weekly price is
 * the one quoted to the visitor; without one, the product's cheapest city
 * stands in so the order is still stable.
 */
function priceSort(locationId: string | undefined): SQL {
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

function orderFor(sort: ProductSort, locationId: string | undefined): SQL[] {
  const byName = [asc(products.name), asc(products.id)];
  const price = priceSort(locationId);

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

function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    timezone: row.timezone,
    description: row.description ?? undefined,
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

/** Rebuilds the nested domain product from its row and child rows. */
function toProduct(row: ProductRow, parts: ProductParts): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: {
      id: parts.category.id,
      slug: parts.category.slug,
      name: parts.category.name,
    },
    images: parts.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? undefined,
    })),
    prices: parts.prices.map((price) => ({
      locationId: price.locationId,
      currency: price.currency,
      weeklyPrice: price.weeklyPrice,
      deposit: price.deposit ?? undefined,
      deliveryFee: price.deliveryFee ?? undefined,
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

function groupByProductId<TRow extends { productId: string }>(rows: TRow[]): Map<string, TRow[]> {
  const grouped = new Map<string, TRow[]>();

  for (const row of rows) {
    const siblings = grouped.get(row.productId);

    if (siblings) siblings.push(row);
    else grouped.set(row.productId, [row]);
  }

  return grouped;
}

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
   * Loads the child rows for a batch of products in one round of queries, so a
   * page of results costs a fixed number of statements instead of one per card.
   * Each child-table statement binds one parameter per product id, so
   * `pageSize`'s cap keeps the batch under D1's statement limits.
   *
   * A row that cannot be shaped into a valid domain product is a data defect,
   * not a read failure: it is dropped instead of failing the whole read.
   */
  async function loadProducts(rows: ProductRow[]): Promise<Product[]> {
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

    const categoriesById = new Map(categoryRows.map((row) => [row.id, row]));
    const imagesByProduct = groupByProductId(imageRows);
    const highlightsByProduct = groupByProductId(highlightRows);
    const specsByProduct = groupByProductId(specRows);
    const pricesByProduct = groupByProductId(priceRows);

    return rows.flatMap((row) => {
      const category = categoriesById.get(row.categoryId);
      if (!category) return [];

      const product = toProduct(row, {
        category,
        images: imagesByProduct.get(row.id) ?? [],
        highlights: highlightsByProduct.get(row.id) ?? [],
        specs: specsByProduct.get(row.id) ?? [],
        prices: pricesByProduct.get(row.id) ?? [],
      });

      return productSchema.safeParse(product).success ? [product] : [];
    });
  }

  async function searchProducts(
    query: ProductQuery,
  ): Promise<z.infer<(typeof searchProductsResult)["schema"]>> {
    const { success, failed } = searchProductsResult;
    const { q, categoryId, locationId, sort, page, pageSize } = query;

    const conditions: SQL[] = [eq(products.status, "active"), pricedSomewhere];

    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (locationId) conditions.push(pricedIn(locationId));

    if (q) {
      const tokens = foldToken(q)
        .split(/\s+/)
        .filter((token) => token.length > 0);

      for (const token of tokens) conditions.push(searchTokenCondition(token));
    }

    const where = and(...conditions);
    const orderBy = orderFor(sort, locationId);

    const batch = await db
      .batch([
        db.select({ total: count() }).from(products).where(where),
        db
          .select()
          .from(products)
          .where(where)
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_search_products", "Failed to search products");

    const [countRows, rows] = batch;
    const total = countRows[0]?.total ?? 0;

    const items = await loadProducts(rows).catch(() => null);
    if (!items) return failed("failed_to_search_products", "Failed to search products");

    return success({
      items,
      total,
      hasMore: page * pageSize < total,
    });
  }

  /** Looks up one visible product by id; agents and API callers hold ids. */
  function getProductById(
    productId: string,
  ): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    return loadProduct(eq(products.id, productId), productId);
  }

  /** Resolves a storefront route key; a product's `slug` is its URL-safe id. */
  function getProductBySlug(slug: string): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    return loadProduct(eq(products.slug, slug), slug);
  }

  /**
   * One visible product by a key. Archived products stay hidden, like on the
   * list side, so a deep link to one is not a live catalog entry.
   */
  async function loadProduct(
    condition: SQL,
    key: string,
  ): Promise<z.infer<(typeof getProductResult)["schema"]>> {
    const { success, failed } = getProductResult;

    const productRows = await db
      .select()
      .from(products)
      .where(and(condition, eq(products.status, "active")))
      .limit(1)
      .catch(() => null);
    if (!productRows) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [row] = productRows;
    if (!row) return failed("product_not_found", `Product ${key} not found`);

    const loadedProducts = await loadProducts([row]).catch(() => null);
    if (!loadedProducts) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [product] = loadedProducts;
    if (!product) return failed("product_data_invalid", `Product ${key} has invalid data`);

    return success(product);
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
