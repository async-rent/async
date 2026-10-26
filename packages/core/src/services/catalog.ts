import {
  categories,
  locations,
  productHighlights,
  productImages,
  productPrices,
  productSpecs,
  products,
} from "@async-rent/db";
import type {
  CategoryRow,
  LocationRow,
  ProductHighlightRow,
  ProductImageRow,
  ProductPriceRow,
  ProductRow,
  ProductSpecRow,
} from "@async-rent/db";
import { and, asc, count, desc, eq, inArray, min, sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import type { Category, Location, Product, ProductPage, ProductSort } from "../types";
import {
  categorySchema,
  locationSchema,
  productPageSchema,
  productQuerySchema,
  productSchema,
  type ProductQueryInput,
} from "../types";
import { createResult } from "../utils";
import type { Result } from "../utils";

export interface CreateCatalogServiceOptions {
  db: DrizzleD1Database;
}

/** Keeps an accidental wall of search words from blowing up the query. */
const maxSearchTokens = 8;

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

/** The order a search applies, with the sort price supplied by the join. */
function orderFor(sort: ProductSort, weeklyPrice: SQLWrapper): SQL[] {
  const byName = [asc(products.name), asc(products.id)];

  switch (sort) {
    case "price_asc":
      return [asc(weeklyPrice), ...byName];
    case "price_desc":
      return [desc(weeklyPrice), ...byName];
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
  const createProductResult = createResult(
    z.void(),
    z.enum(["product_already_exists", "failed_to_fetch_product", "failed_to_save_product"]),
  );

  const searchProductsResult = createResult(
    productPageSchema,
    z.enum(["invalid_product_query", "failed_to_search_products"]),
  );

  const getProductResult = createResult(
    productSchema,
    z.enum(["product_not_found", "failed_to_fetch_product"]),
  );

  const listLocationsResult = createResult(
    z.array(locationSchema),
    z.enum(["failed_to_list_locations"]),
  );

  const listCategoriesResult = createResult(
    z.array(categorySchema),
    z.enum(["failed_to_list_categories"]),
  );

  const productsTable = {} as SQLiteTable;

  async function createProduct(
    product: Product,
  ): Promise<z.infer<(typeof createProductResult)["schema"]>> {
    const { success, failed } = createProductResult;

    const existingProducts = await db
      .select()
      .from(productsTable)
      .catch(() => null);
    if (!existingProducts) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [existingProduct] = existingProducts;
    if (existingProduct)
      return failed("product_already_exists", `Product with id ${product.id} already exists`);

    const saveProduct = await db
      .insert(productsTable)
      .values({})
      .returning({})
      .catch(() => null);
    if (!saveProduct) return failed("failed_to_save_product", "Failed to save product");

    return success();
  }

  /**
   * One row per product with the price a search sorts on: the selected city's
   * weekly price, or the cheapest city when no city is chosen.
   *
   * Grouping by product is what keeps the join safe: `product_prices` can hold
   * a row per city, so joining it directly would repeat a product once per city
   * — and make `count()` report more rows than the page holds. The subquery
   * folds those rows down to exactly one per product.
   *
   * The inner join against it doubles as the availability filter: a product
   * with no price row for the selected city (or no price anywhere when no city
   * is selected) has nothing to join to and drops out.
   */
  function pricedProducts(locationId: string | undefined) {
    return db
      .select({
        productId: productPrices.productId,
        weeklyPrice: min(productPrices.weeklyPrice).as("weekly_price"),
      })
      .from(productPrices)
      .where(locationId ? eq(productPrices.locationId, locationId) : undefined)
      .groupBy(productPrices.productId)
      .as("product_price");
  }

  /**
   * Loads the child rows for a batch of products in one round of queries, so a
   * page of results costs a fixed number of statements instead of one per card.
   */
  async function loadProducts(rows: ProductRow[]): Promise<Product[]> {
    if (rows.length === 0) return [];

    const productIds = rows.map((row) => row.id);
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];

    const [categoryRows, imageRows, highlightRows, specRows, priceRows] = await Promise.all([
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

    return rows.map((row) => {
      const category = categoriesById.get(row.categoryId);
      if (!category) throw new Error(`Product ${row.id} references a missing category`);

      return toProduct(row, {
        category,
        images: imagesByProduct.get(row.id) ?? [],
        highlights: highlightsByProduct.get(row.id) ?? [],
        specs: specsByProduct.get(row.id) ?? [],
        prices: pricesByProduct.get(row.id) ?? [],
      });
    });
  }

  async function searchProducts(
    query: ProductQueryInput = {},
  ): Promise<Result<ProductPage, "invalid_product_query" | "failed_to_search_products">> {
    const { success, failed } = searchProductsResult;

    const parsed = productQuerySchema.safeParse(query);
    if (!parsed.success) return failed("invalid_product_query", "Invalid product query");

    const { q, categoryId, locationId, sort, page, pageSize } = parsed.data;

    const conditions: SQL[] = [eq(products.status, "active")];

    if (categoryId) conditions.push(eq(products.categoryId, categoryId));

    if (q) {
      const tokens = q
        .toLowerCase()
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .slice(0, maxSearchTokens);

      for (const token of tokens) conditions.push(searchTokenCondition(token));
    }

    const where = and(...conditions);
    const prices = pricedProducts(locationId);
    const orderBy = orderFor(sort, prices.weeklyPrice);

    try {
      const [countRows, rows] = await Promise.all([
        db
          .select({ total: count() })
          .from(products)
          .innerJoin(prices, eq(prices.productId, products.id))
          .where(where),
        db
          .select()
          .from(products)
          .innerJoin(prices, eq(prices.productId, products.id))
          .where(where)
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ]);

      const total = countRows[0]?.total ?? 0;
      const items = await loadProducts(rows.map((row) => row.products));

      return success({
        items,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      });
    } catch {
      return failed("failed_to_search_products", "Failed to search products");
    }
  }

  async function getProduct(
    productId: string,
  ): Promise<Result<Product, "product_not_found" | "failed_to_fetch_product">> {
    const { success, failed } = getProductResult;

    try {
      const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (!row) return failed("product_not_found", `Product ${productId} not found`);

      const [product] = await loadProducts([row]);

      return success(product);
    } catch {
      return failed("failed_to_fetch_product", "Failed to fetch product");
    }
  }

  async function listLocations(): Promise<Result<Location[], "failed_to_list_locations">> {
    const { success, failed } = listLocationsResult;

    try {
      const rows = await db
        .select()
        .from(locations)
        .orderBy(asc(locations.name), asc(locations.id));

      return success(rows.map(toLocation));
    } catch {
      return failed("failed_to_list_locations", "Failed to list locations");
    }
  }

  async function listCategories(): Promise<Result<Category[], "failed_to_list_categories">> {
    const { success, failed } = listCategoriesResult;

    try {
      const rows = await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id));

      return success(rows.map(toCategory));
    } catch {
      return failed("failed_to_list_categories", "Failed to list categories");
    }
  }

  return {
    createProduct,
    searchProducts,
    getProduct,
    listLocations,
    listCategories,
  };
}
