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
import type { Category, Location, Product, ProductPrice } from "../schemas";
import { categorySchema, locationSchema, productSchema } from "../schemas";
import { attempt, createResult, groupBy, paginationSchema } from "../utils";

export interface CreateCatalogServiceOptions {
  db: DrizzleD1Database;
}

export const productSortSchema = z
  .enum(["featured", "price_asc", "price_desc", "name_asc", "newest"])
  .describe("Result order; price sorts use the selected location when one is given.");

export type ProductSort = z.infer<typeof productSortSchema>;

export const maxSearchTokens = 8;

export const productQuerySchema = z.object({
  q: z
    .string()
    .max(120)
    .refine(
      (q) =>
        q
          .trim()
          .split(/\s+/)
          .filter((token) => token.length > 0).length <= maxSearchTokens,
    )
    .optional()
    .describe(
      `Free-text search over name, tagline, description and category; every word must match (max ${maxSearchTokens} words).`,
    ),
  categoryId: z.string().optional().describe("Only return products in this category."),
  locationId: z.string().optional().describe("Only return products rentable in this location."),
  sort: productSortSchema.default("featured"),
  page: z.number().int().positive().max(100).default(1).describe("1-based page number."),
  // One bound parameter per product id; 48 stays under D1's 100-parameter statement limit.
  pageSize: z
    .number()
    .int()
    .positive()
    .max(48)
    .default(12)
    .describe("Number of products per page (max 48)."),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export const searchProductsInputSchema = productQuerySchema;
export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

export const productPageSchema = paginationSchema(productSchema);
export type ProductPage = z.infer<typeof productPageSchema>;

export const getProductByIdInputSchema = z.object({
  productId: z.string().describe("Product identifier."),
});

export type GetProductByIdInput = z.infer<typeof getProductByIdInputSchema>;

export const getProductBySlugInputSchema = z.object({
  slug: z.string().describe("Product route slug, e.g. smartdesk-pro."),
});

export type GetProductBySlugInput = z.infer<typeof getProductBySlugInputSchema>;

const searchProductsResult = createResult(productPageSchema, z.enum(["failed_to_search_products"]));

export const searchProductsResultSchema = searchProductsResult.schema;
export type SearchProductsResult = z.infer<typeof searchProductsResultSchema>;

const getProductResult = createResult(
  productSchema,
  z.enum(["product_not_found", "failed_to_fetch_product", "product_data_invalid"]),
);

export const getProductResultSchema = getProductResult.schema;
export type GetProductResult = z.infer<typeof getProductResultSchema>;

const listLocationsResult = createResult(
  z.array(locationSchema),
  z.enum(["failed_to_list_locations"]),
);

export const listLocationsResultSchema = listLocationsResult.schema;
export type ListLocationsResult = z.infer<typeof listLocationsResultSchema>;

const listCategoriesResult = createResult(
  z.array(categorySchema),
  z.enum(["failed_to_list_categories"]),
);

export const listCategoriesResultSchema = listCategoriesResult.schema;
export type ListCategoriesResult = z.infer<typeof listCategoriesResultSchema>;

/**
 * The price a product carries in one location, or `undefined` when the location
 * does not rent it. Pure: it only reads the product the caller already holds.
 */
export function priceForLocation(product: Product, locationId: string): ProductPrice | undefined {
  return product.prices.find((price) => price.locationId === locationId);
}

/** Whether a location is open for rentals rather than announced for later. */
export function isLocationActive(location: Pick<Location, "status">): boolean {
  return location.status === "active";
}

/** Input to the pure `isProductRentable` check. */
export const isProductRentableInputSchema = z.object({
  product: productSchema,
  locationId: z.string().optional().describe("Location to check; rentable anywhere when omitted."),
});

export type IsProductRentableInput = z.infer<typeof isProductRentableInputSchema>;

/**
 * Whether a product can be rented right now: it must be active, and when a
 * location is named it must be priced there. Pure, so apps can gate a "Rent"
 * button without a round trip.
 */
export function isProductRentable(input: IsProductRentableInput): boolean {
  const { product, locationId } = input;

  if (product.status !== "active") return false;
  if (!locationId) return product.prices.length > 0;

  return priceForLocation(product, locationId) !== undefined;
}

const rentedIn = (locationId: string): SQL => sql`exists (
  select 1 from ${productPrices}
  where ${productPrices.productId} = ${products.id}
    and ${productPrices.locationId} = ${locationId}
)`;

const rentedAnywhere: SQL = sql`exists (
  select 1 from ${productPrices}
  where ${productPrices.productId} = ${products.id}
)`;

// SQLite's lower() only handles ASCII (D1 has no ICU).
function searchWords(q: string | undefined): string[] {
  if (!q) return [];

  return q
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

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

// Every order ends with name and id, so equal rows keep the same order.
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

export function createCatalogService({ db }: CreateCatalogServiceOptions) {
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
    const imagesOf = groupBy(imageRows, (row) => row.productId);
    const highlightsOf = groupBy(highlightRows, (row) => row.productId);
    const specsOf = groupBy(specRows, (row) => row.productId);
    const pricesOf = groupBy(priceRows, (row) => row.productId);

    // A product whose stored rows do not fit the schema is left out rather than
    // failing the whole read: one malformed row never takes the page down.
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

  async function searchProducts(input: SearchProductsInput): Promise<SearchProductsResult> {
    const { ok, err } = searchProductsResult;
    const { q, categoryId, locationId, sort, page, pageSize } = input;

    const where = and(
      eq(products.status, "active"),
      rentedAnywhere,
      categoryId ? eq(products.categoryId, categoryId) : undefined,
      locationId ? rentedIn(locationId) : undefined,
      ...searchWords(q).map(matchesWord),
    );

    const counted = await attempt(
      db.batch([
        db.select({ total: count() }).from(products).where(where),
        db
          .select()
          .from(products)
          .where(where)
          .orderBy(...orderBy(sort, locationId))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ]),
    );
    if (!counted.ok) {
      return err("failed_to_search_products", "Failed to search products", counted.error);
    }

    const [[total], rows] = counted.value;

    const items = await attempt(withDetails(rows));
    if (!items.ok) {
      return err("failed_to_search_products", "Failed to search products", items.error);
    }

    return ok({
      items: items.value,
      total: total?.total ?? 0,
      hasMore: page * pageSize < (total?.total ?? 0),
    });
  }

  async function findProduct(condition: SQL, key: string): Promise<GetProductResult> {
    const { ok, err } = getProductResult;

    const rows = await attempt(
      db
        .select()
        .from(products)
        .where(and(condition, eq(products.status, "active")))
        .limit(1),
    );
    if (!rows.ok) return err("failed_to_fetch_product", "Failed to fetch product", rows.error);

    const [row] = rows.value;
    if (!row) return err("product_not_found", `Product ${key} not found`);

    const found = await attempt(withDetails([row]));
    if (!found.ok) return err("failed_to_fetch_product", "Failed to fetch product", found.error);

    const [product] = found.value;
    if (!product) return err("product_data_invalid", `Product ${key} has invalid data`);

    return ok(product);
  }

  function getProductById(input: GetProductByIdInput): Promise<GetProductResult> {
    return findProduct(eq(products.id, input.productId), input.productId);
  }

  function getProductBySlug(input: GetProductBySlugInput): Promise<GetProductResult> {
    return findProduct(eq(products.slug, input.slug), input.slug);
  }

  async function listLocations(): Promise<ListLocationsResult> {
    const { ok, err } = listLocationsResult;

    const rows = await attempt(
      db.select().from(locations).orderBy(asc(locations.name), asc(locations.id)),
    );
    if (!rows.ok) return err("failed_to_list_locations", "Failed to list locations", rows.error);

    return ok(rows.value.map(toLocation));
  }

  async function listCategories(): Promise<ListCategoriesResult> {
    const { ok, err } = listCategoriesResult;

    const rows = await attempt(
      db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id)),
    );
    if (!rows.ok) return err("failed_to_list_categories", "Failed to list categories", rows.error);

    return ok(rows.value.map(toCategory));
  }

  return {
    searchProducts,
    getProductById,
    getProductBySlug,
    listLocations,
    listCategories,
    // Pure helpers, exposed on the service so apps use one surface.
    isProductRentable,
    isLocationActive,
    priceForLocation,
  };
}
