import { fromAny } from "@total-typescript/shoehorn";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { describe, expect, it, vi } from "vite-plus/test";
import { makeProduct } from "../../tests/factories";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import type { ProductQuery } from "../types";
import { createCatalogService } from "./catalog";

interface DbMockOptions {
  /** Rows returned by the existence lookup. Defaults to none. */
  existing?: unknown[];
  /** When set, the existence lookup rejects instead of resolving. */
  selectError?: Error;
  /** When set, the insert rejects instead of resolving. */
  insertError?: Error;
}

function createDbMock(options: DbMockOptions = {}) {
  const select = vi.fn(() => ({
    from: () =>
      options.selectError
        ? Promise.reject(options.selectError)
        : Promise.resolve(options.existing ?? []),
  }));

  const insert = vi.fn(() => ({
    values: () => ({
      returning: () =>
        options.insertError ? Promise.reject(options.insertError) : Promise.resolve([{}]),
    }),
  }));

  const db: DrizzleD1Database = fromAny({ select, insert });

  return { db, select, insert };
}

describe("createCatalogService", () => {
  it("creates a product when none exists", async () => {
    const { db, select, insert } = createDbMock({ existing: [] });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({ success: true });

    expect(select).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("fails when a product with the same id already exists", async () => {
    const product = makeProduct();
    const { db, insert } = createDbMock({ existing: [product] });
    const service = createCatalogService({ db });

    const result = await service.createProduct(product);

    expect(result).toEqual({
      success: false,
      error: {
        code: "product_already_exists",
        message: `Product with id ${product.id} already exists`,
      },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails when the existence lookup throws", async () => {
    const { db } = createDbMock({ selectError: new Error("d1 unavailable") });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_product", message: "Failed to fetch product" },
    });
  });

  it("fails when the insert throws", async () => {
    const { db } = createDbMock({ insertError: new Error("d1 unavailable") });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_save_product", message: "Failed to save product" },
    });
  });
});

/** A fixed timestamp, so `createdAt` assertions never depend on the clock. */
const createdAt = Date.UTC(2026, 0, 1);

interface ProductFixture {
  id: string;
  /** Route key. Defaults to the id, so most fixtures are never looked up by slug. */
  slug?: string;
  name: string;
  categoryId?: string;
  tagline?: string;
  description?: string;
  badge?: string;
  featured?: boolean;
  status?: "active" | "archived";
  createdAtOffset?: number;
  images?: string[];
  highlights?: string[];
  specs?: { label: string; value: string }[];
  prices?: {
    locationId: string;
    weeklyPrice: number;
    deposit?: number;
    deliveryFee?: number;
    stock?: number;
  }[];
}

function seedCitiesAndCategories({ sqlite }: TestDatabase): void {
  sqlite.exec(`
    INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES
      ('loc_bali',    'bali',    'Bali',    'Indonesia', 'Asia/Makassar', 'Canggu and Ubud desks.', 'active'),
      ('loc_lisbon',  'lisbon',  'Lisbon',  'Portugal',  'Europe/Lisbon', NULL,                     'active'),
      ('loc_ko_tao',  'ko-tao',  'Ko Tao',  'Thailand',  'Asia/Bangkok',  'Opening next season.',   'coming_soon');

    INSERT INTO categories (id, slug, name, description, sort_order) VALUES
      ('cat_lighting', 'lighting', 'Lighting', 'Lamps and ambience.',          3),
      ('cat_desks',    'desks',    'Desks',    'Standing and fixed desks.',    1),
      ('cat_chairs',   'chairs',   'Chairs',   'Ergonomic seating.',           2);
  `);
}

function insertProduct(database: TestDatabase, fixture: ProductFixture): void {
  const { sqlite } = database;
  const categoryId = fixture.categoryId ?? "cat_desks";

  sqlite
    .prepare(
      `INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fixture.id,
      fixture.slug ?? fixture.id,
      fixture.name,
      fixture.tagline ?? "A product for the test catalog.",
      fixture.description ?? "Long-form copy for the product page.",
      categoryId,
      fixture.badge ?? null,
      fixture.featured ? 1 : 0,
      fixture.status ?? "active",
      createdAt + (fixture.createdAtOffset ?? 0),
    );

  const images = fixture.images ?? [`https://cdn.async.rent/${fixture.id}-0.jpg`];

  images.forEach((url, position) => {
    sqlite
      .prepare("INSERT INTO product_images (product_id, position, url, alt) VALUES (?, ?, ?, ?)")
      .run(fixture.id, position, url, fixture.name);
  });

  (fixture.highlights ?? []).forEach((value, position) => {
    sqlite
      .prepare("INSERT INTO product_highlights (product_id, position, value) VALUES (?, ?, ?)")
      .run(fixture.id, position, value);
  });

  (fixture.specs ?? []).forEach((spec, position) => {
    sqlite
      .prepare("INSERT INTO product_specs (product_id, position, label, value) VALUES (?, ?, ?, ?)")
      .run(fixture.id, position, spec.label, spec.value);
  });

  const prices = fixture.prices ?? [{ locationId: "loc_bali", weeklyPrice: 10000 }];

  for (const price of prices) {
    sqlite
      .prepare(
        `INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee, stock)
         VALUES (?, ?, 'USD', ?, ?, ?, ?)`,
      )
      .run(
        fixture.id,
        price.locationId,
        price.weeklyPrice,
        price.deposit ?? null,
        price.deliveryFee ?? null,
        price.stock ?? null,
      );
  }
}

/**
 * Four active products, one archived product and skewed per-city prices.
 *
 * Bali:    oak 9000  < smartdesk 12000
 * Lisbon:  chair 10000 < smartdesk 13000 < oak 20000
 *
 * so a price sort that ignored the city would get the order wrong.
 */
function seedCatalog(database: TestDatabase): void {
  seedCitiesAndCategories(database);

  insertProduct(database, {
    id: "prd_smartdesk",
    slug: "smartdesk-pro",
    name: "SmartDesk Pro",
    tagline: "Electric standing desk with memory presets",
    description: "A dual-motor desk that moves in seconds.",
    badge: "Most rented",
    featured: true,
    createdAtOffset: 1000,
    images: [
      "https://cdn.async.rent/smartdesk-pro-0.jpg",
      "https://cdn.async.rent/smartdesk-pro-1.jpg",
    ],
    highlights: ["Memory presets", "Cable tray"],
    specs: [{ label: "Height range", value: "62–128 cm" }],
    prices: [
      { locationId: "loc_bali", weeklyPrice: 12000, deposit: 24000, deliveryFee: 5000, stock: 3 },
      { locationId: "loc_lisbon", weeklyPrice: 13000 },
    ],
  });

  insertProduct(database, {
    id: "prd_oak",
    slug: "oak-writing-desk",
    name: "Oak Writing Desk",
    tagline: "Solid oak fixed-height desk",
    description: "A quiet wooden desk with two grommets.",
    createdAtOffset: 2000,
    prices: [
      { locationId: "loc_bali", weeklyPrice: 9000 },
      { locationId: "loc_lisbon", weeklyPrice: 20000 },
    ],
  });

  insertProduct(database, {
    id: "prd_chair",
    slug: "ergonomic-task-chair",
    name: "Ergonomic Task Chair",
    categoryId: "cat_chairs",
    tagline: "Mesh-back chair with 4D armrests",
    description: "Breathable mesh and adjustable lumbar support.",
    featured: true,
    createdAtOffset: 3000,
    prices: [{ locationId: "loc_lisbon", weeklyPrice: 10000 }],
  });

  insertProduct(database, {
    id: "prd_lamp",
    slug: "arc-floor-lamp",
    name: "Arc Floor Lamp",
    categoryId: "cat_lighting",
    tagline: "Dimmable arc lamp in warm white",
    description: "Reaches over any desk without a clamp.",
    createdAtOffset: 4000,
    prices: [{ locationId: "loc_bali", weeklyPrice: 4000 }],
  });

  insertProduct(database, {
    id: "prd_archived",
    slug: "archived-desk",
    name: "Archived Desk",
    status: "archived",
    prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
  });
}

function setup() {
  const database = createTestDatabase();
  seedCatalog(database);

  return { ...database, service: createCatalogService({ db: database.db }) };
}

/** Spells out a fully parsed query so each case's page shape stays explicit. */
function makeQuery(overrides: Partial<ProductQuery> = {}): ProductQuery {
  return {
    sort: "featured",
    page: 1,
    pageSize: 12,
    ...overrides,
  };
}

describe("searchProducts", () => {
  it("returns active products with their nested details and total", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery({ sort: "name_asc" }));
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.total).toBe(4);
    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_chair",
      "prd_oak",
      "prd_smartdesk",
    ]);

    const smartdesk = result.data.items.find((product) => product.id === "prd_smartdesk");

    expect(smartdesk).toMatchObject({
      name: "SmartDesk Pro",
      tagline: "Electric standing desk with memory presets",
      category: { id: "cat_desks", slug: "desks", name: "Desks" },
      images: [
        { url: "https://cdn.async.rent/smartdesk-pro-0.jpg", alt: "SmartDesk Pro" },
        { url: "https://cdn.async.rent/smartdesk-pro-1.jpg", alt: "SmartDesk Pro" },
      ],
      prices: [
        {
          locationId: "loc_bali",
          currency: "USD",
          weeklyPrice: 12000,
          deposit: 24000,
          deliveryFee: 5000,
          stock: 3,
        },
        { locationId: "loc_lisbon", currency: "USD", weeklyPrice: 13000 },
      ],
      highlights: ["Memory presets", "Cable tray"],
      specs: [{ label: "Height range", value: "62–128 cm" }],
      badge: "Most rented",
      featured: true,
      status: "active",
    });
    expect(smartdesk?.createdAt).toBe(new Date(createdAt + 1000).toISOString());
    expect(smartdesk?.updatedAt).toBeUndefined();
  });

  it("puts featured products first by default", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery());
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_chair",
      "prd_smartdesk",
      "prd_lamp",
      "prd_oak",
    ]);
  });

  it("filters by category", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery({ categoryId: "cat_chairs" }));
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.total).toBe(1);
    expect(result.data.items.map((product) => product.id)).toEqual(["prd_chair"]);
  });

  it("only shows products available in the requested city", async () => {
    const { service } = setup();

    const result = await service.searchProducts(
      makeQuery({ locationId: "loc_bali", sort: "name_asc" }),
    );
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.total).toBe(3);
    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_oak",
      "prd_smartdesk",
    ]);
  });

  it("matches every search word against the name, copy and category", async () => {
    const { service } = setup();

    const mesh = await service.searchProducts(makeQuery({ q: "BREATHABLE mesh" }));
    if (!mesh.success) throw new Error(mesh.error.message);
    expect(mesh.data.items.map((product) => product.id)).toEqual(["prd_chair"]);

    const lighting = await service.searchProducts(makeQuery({ q: "lighting" }));
    if (!lighting.success) throw new Error(lighting.error.message);
    expect(lighting.data.items.map((product) => product.id)).toEqual(["prd_lamp"]);

    const nothing = await service.searchProducts(makeQuery({ q: "breathable desk" }));
    if (!nothing.success) throw new Error(nothing.error.message);
    expect(nothing.data.items).toEqual([]);
    expect(nothing.data.total).toBe(0);
  });

  it("treats search words as text, not as wildcards", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery({ q: "%" }));
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.total).toBe(0);
  });

  it("folds search words the way SQLite folds them: ASCII case-insensitive, other scripts case-exact", async () => {
    const context = setup();
    insertProduct(context, {
      id: "prd_cafe",
      name: "CAFÉ Lounge Chair",
      categoryId: "cat_chairs",
      prices: [{ locationId: "loc_bali", weeklyPrice: 20000 }],
    });
    const { service } = context;

    const sameCase = await service.searchProducts(makeQuery({ q: "CAFÉ" }));
    if (!sameCase.success) throw new Error(sameCase.error.message);
    expect(sameCase.data.items.map((product) => product.id)).toEqual(["prd_cafe"]);

    const otherCase = await service.searchProducts(makeQuery({ q: "café" }));
    if (!otherCase.success) throw new Error(otherCase.error.message);
    expect(otherCase.data.items).toEqual([]);
  });

  it("sorts by the weekly price in the selected city", async () => {
    const { service } = setup();

    const bali = await service.searchProducts(
      makeQuery({ locationId: "loc_bali", sort: "price_asc" }),
    );
    if (!bali.success) throw new Error(bali.error.message);
    expect(bali.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_oak",
      "prd_smartdesk",
    ]);

    const lisbon = await service.searchProducts(
      makeQuery({ locationId: "loc_lisbon", sort: "price_asc" }),
    );
    if (!lisbon.success) throw new Error(lisbon.error.message);
    expect(lisbon.data.items.map((product) => product.id)).toEqual([
      "prd_chair",
      "prd_smartdesk",
      "prd_oak",
    ]);

    const expensive = await service.searchProducts(
      makeQuery({ locationId: "loc_lisbon", sort: "price_desc" }),
    );
    if (!expensive.success) throw new Error(expensive.error.message);
    expect(expensive.data.items.map((product) => product.id)).toEqual([
      "prd_oak",
      "prd_smartdesk",
      "prd_chair",
    ]);

    const anywhere = await service.searchProducts(makeQuery({ sort: "price_asc" }));
    if (!anywhere.success) throw new Error(anywhere.error.message);
    expect(anywhere.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_oak",
      "prd_chair",
      "prd_smartdesk",
    ]);
  });

  it("sorts newest first", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery({ sort: "newest" }));
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_chair",
      "prd_oak",
      "prd_smartdesk",
    ]);
  });

  it("returns page-sized chunks so the total covers every page", async () => {
    const { service } = setup();

    const first = await service.searchProducts(
      makeQuery({ sort: "name_asc", page: 1, pageSize: 2 }),
    );
    if (!first.success) throw new Error(first.error.message);
    expect(first.data).toEqual({ total: 4, hasMore: true, items: expect.any(Array) });
    expect(first.data.items.map((product) => product.id)).toEqual(["prd_lamp", "prd_chair"]);

    const second = await service.searchProducts(
      makeQuery({ sort: "name_asc", page: 2, pageSize: 2 }),
    );
    if (!second.success) throw new Error(second.error.message);
    expect(second.data.total).toBe(4);
    expect(second.data.hasMore).toBe(false);
    expect(second.data.items.map((product) => product.id)).toEqual(["prd_oak", "prd_smartdesk"]);
  });

  it("keeps the page up when one product's data is malformed", async () => {
    const context = setup();
    insertProduct(context, {
      id: "prd_imageless",
      name: "Frameless Cork Board",
      prices: [{ locationId: "loc_bali", weeklyPrice: 6000 }],
      images: [],
    });
    const { service } = context;

    const result = await service.searchProducts(makeQuery({ sort: "name_asc" }));
    if (!result.success) throw new Error(result.error.message);

    // SQL counts every matching row, valid or not; only rows that can be
    // shaped into a product reach the page. The whole catalog still fits one
    // page, so the short page is also the last one.
    expect(result.data.total).toBe(5);
    expect(result.data.hasMore).toBe(false);
    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_chair",
      "prd_oak",
      "prd_smartdesk",
    ]);
  });

  it("keeps paging when a dropped row shortens a page", async () => {
    const context = setup();
    // The invalid row sorts first among the paged ones, onto page 1.
    insertProduct(context, {
      id: "prd_paged_broken",
      name: "Paged Desk 00",
      images: [],
    });
    for (let i = 1; i <= 12; i++) {
      insertProduct(context, {
        id: `prd_paged_${String(i).padStart(2, "0")}`,
        name: `Paged Desk ${String(i).padStart(2, "0")}`,
      });
    }
    const { service } = context;

    const first = await service.searchProducts(makeQuery({ sort: "name_asc", pageSize: 12 }));
    if (!first.success) throw new Error(first.error.message);

    // 17 matching rows, 16 valid; the dropped row makes page 1 hold 11 items.
    expect(first.data.total).toBe(17);
    expect(first.data.items).toHaveLength(11);
    expect(first.data.hasMore).toBe(true);

    const second = await service.searchProducts(
      makeQuery({ sort: "name_asc", page: 2, pageSize: 12 }),
    );
    if (!second.success) throw new Error(second.error.message);

    expect(second.data.items).toHaveLength(5);
    expect(second.data.items.map((product) => product.id)).toContain("prd_paged_12");
    expect(second.data.hasMore).toBe(false);
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.searchProducts(makeQuery())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_search_products", message: "Failed to search products" },
    });
  });
});

describe("getProductById", () => {
  it("returns one product with its full details", async () => {
    const { service } = setup();

    const result = await service.getProductById("prd_smartdesk");
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      id: "prd_smartdesk",
      slug: "smartdesk-pro",
      name: "SmartDesk Pro",
      category: { id: "cat_desks", slug: "desks", name: "Desks" },
      prices: [
        { locationId: "loc_bali", weeklyPrice: 12000 },
        { locationId: "loc_lisbon", weeklyPrice: 13000 },
      ],
      highlights: ["Memory presets", "Cable tray"],
      specs: [{ label: "Height range", value: "62–128 cm" }],
    });
  });

  it("fails when the product does not exist", async () => {
    const { service } = setup();

    await expect(service.getProductById("prd_missing")).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product prd_missing not found" },
    });
  });

  it("does not serve archived products that search hides", async () => {
    const { service } = setup();

    await expect(service.getProductById("prd_archived")).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product prd_archived not found" },
    });
  });

  it("reports bad product data instead of a read failure", async () => {
    const context = setup();
    insertProduct(context, {
      id: "prd_imageless",
      name: "Frameless Cork Board",
      prices: [{ locationId: "loc_bali", weeklyPrice: 6000 }],
      images: [],
    });
    const { service } = context;

    await expect(service.getProductById("prd_imageless")).resolves.toEqual({
      success: false,
      error: {
        code: "product_data_invalid",
        message: "Product prd_imageless has invalid data",
      },
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.getProductById("prd_smartdesk")).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_product", message: "Failed to fetch product" },
    });
  });
});

describe("getProductBySlug", () => {
  it("resolves a route slug to the full product", async () => {
    const { service } = setup();

    const result = await service.getProductBySlug("smartdesk-pro");
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      id: "prd_smartdesk",
      slug: "smartdesk-pro",
      name: "SmartDesk Pro",
      category: { id: "cat_desks", slug: "desks", name: "Desks" },
    });
  });

  it("looks up the slug column, not the id column", async () => {
    const { service } = setup();

    // A slug that matches no product.
    await expect(service.getProductBySlug("missing-desk")).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product missing-desk not found" },
    });

    // An id is not a slug: prd_smartdesk's slug is smartdesk-pro.
    await expect(service.getProductBySlug("prd_smartdesk")).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product prd_smartdesk not found" },
    });
  });

  it("does not serve archived products either, so a deep link to one is dead", async () => {
    const { service } = setup();

    await expect(service.getProductBySlug("archived-desk")).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product archived-desk not found" },
    });
  });
});

describe("listLocations", () => {
  it("returns every city in name order, including ones that are coming soon", async () => {
    const { service } = setup();

    const result = await service.listLocations();
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.map((location) => location.name)).toEqual(["Bali", "Ko Tao", "Lisbon"]);
    expect(result.data.find((location) => location.id === "loc_ko_tao")).toMatchObject({
      slug: "ko-tao",
      country: "Thailand",
      timezone: "Asia/Bangkok",
      description: "Opening next season.",
      status: "coming_soon",
    });
    expect(
      result.data.find((location) => location.id === "loc_lisbon")?.description,
    ).toBeUndefined();
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.listLocations()).resolves.toEqual({
      success: false,
      error: { code: "failed_to_list_locations", message: "Failed to list locations" },
    });
  });
});

describe("listCategories", () => {
  it("returns categories in their display order", async () => {
    const { service } = setup();

    const result = await service.listCategories();
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.map((category) => category.id)).toEqual([
      "cat_desks",
      "cat_chairs",
      "cat_lighting",
    ]);
    expect(result.data[0]).toEqual({
      id: "cat_desks",
      slug: "desks",
      name: "Desks",
      description: "Standing and fixed desks.",
      sortOrder: 1,
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.listCategories()).resolves.toEqual({
      success: false,
      error: { code: "failed_to_list_categories", message: "Failed to list categories" },
    });
  });
});
