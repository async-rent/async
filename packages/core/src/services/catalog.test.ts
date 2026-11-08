import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import { makeCategory, makeProduct } from "../../tests/factories";
import { createCatalogService, isSetup, setupParts, type ProductQuery } from "./catalog";

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
    stock?: number;
  }[];
}

function seedCitiesAndCategories({ sqlite }: TestDatabase): void {
  sqlite.exec(`
    INSERT INTO locations (id, slug, name, country, timezone, description, currency, delivery_fee, status) VALUES
      ('loc_bali',    'bali',    'Bali',    'Indonesia', 'Asia/Makassar', 'Canggu and Ubud desks.', 'USD', 1000, 'active'),
      ('loc_lisbon',  'lisbon',  'Lisbon',  'Portugal',  'Europe/Lisbon', NULL,                     'USD', 1500, 'active'),
      ('loc_ko_tao',  'ko-tao',  'Ko Tao',  'Thailand', 'Asia/Bangkok',  'Opening next season.',   'USD',  500, 'coming_soon');

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
        `INSERT INTO product_prices (product_id, location_id, weekly_price, deposit, stock)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        fixture.id,
        price.locationId,
        price.weeklyPrice,
        price.deposit ?? null,
        price.stock ?? null,
      );
  }
}

interface RentalFixture {
  id: string;
  locationId: string;
  status: "pending_payment" | "confirmed" | "active" | "completed" | "cancelled";
  items: { productId: string; quantity: number }[];
}

function insertRental({ sqlite }: TestDatabase, fixture: RentalFixture): void {
  sqlite
    .prepare(
      `INSERT INTO rentals (id, number, contact_name, contact_email, address_line1, address_city,
         address_country_code, location_id, currency, start_date, status)
       VALUES (?, ?, 'Ada', 'ada@example.com', 'Jl. Pantai 1', 'Canggu', 'ID', ?, 'USD', '2026-01-05', ?)`,
    )
    .run(fixture.id, fixture.id.toUpperCase(), fixture.locationId, fixture.status);

  fixture.items.forEach((item, position) => {
    sqlite
      .prepare(
        `INSERT INTO rental_items (rental_id, position, product_id, name, slug, quantity, weekly_price)
         VALUES (?, ?, ?, ?, ?, ?, 1000)`,
      )
      .run(fixture.id, position, item.productId, item.productId, item.productId, item.quantity);
  });
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
      { locationId: "loc_bali", weeklyPrice: 12000, deposit: 24000, stock: 3 },
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
      categoryId: "cat_desks",
      images: [
        { url: "https://cdn.async.rent/smartdesk-pro-0.jpg", alt: "SmartDesk Pro" },
        { url: "https://cdn.async.rent/smartdesk-pro-1.jpg", alt: "SmartDesk Pro" },
      ],
      prices: [
        {
          locationId: "loc_bali",
          weeklyPrice: 12000,
          deposit: 24000,
          stock: 3,
        },
        { locationId: "loc_lisbon", weeklyPrice: 13000 },
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

  it("leaves out excluded categories, counting only what is left", async () => {
    const { service } = setup();

    const result = await service.searchProducts(
      makeQuery({ excludeCategoryIds: ["cat_desks", "cat_lighting"] }),
    );
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.total).toBe(1);
    expect(result.data.items.map((product) => product.id)).toEqual(["prd_chair"]);

    const none = await service.searchProducts(makeQuery({ excludeCategoryIds: [] }));
    if (!none.success) throw new Error(none.error.message);
    expect(none.data.total).toBe(4);
  });

  it("puts the most rented first, counting only placed rentals in the selected city", async () => {
    const context = setup();
    insertRental(context, {
      id: "rnt_bali_paid",
      locationId: "loc_bali",
      status: "active",
      items: [{ productId: "prd_lamp", quantity: 3 }],
    });
    insertRental(context, {
      id: "rnt_bali_returned",
      locationId: "loc_bali",
      status: "completed",
      items: [{ productId: "prd_oak", quantity: 1 }],
    });
    // Neither an unpaid nor a cancelled order is demand.
    insertRental(context, {
      id: "rnt_bali_unpaid",
      locationId: "loc_bali",
      status: "pending_payment",
      items: [{ productId: "prd_smartdesk", quantity: 5 }],
    });
    insertRental(context, {
      id: "rnt_bali_cancelled",
      locationId: "loc_bali",
      status: "cancelled",
      items: [{ productId: "prd_oak", quantity: 5 }],
    });
    // Lisbon's rentals only move Lisbon's order.
    insertRental(context, {
      id: "rnt_lisbon",
      locationId: "loc_lisbon",
      status: "confirmed",
      items: [
        { productId: "prd_smartdesk", quantity: 2 },
        { productId: "prd_oak", quantity: 6 },
      ],
    });
    const { service } = context;

    const bali = await service.searchProducts(
      makeQuery({ locationId: "loc_bali", sort: "popular" }),
    );
    if (!bali.success) throw new Error(bali.error.message);
    expect(bali.data.items.map((product) => product.id)).toEqual([
      "prd_lamp",
      "prd_oak",
      "prd_smartdesk",
    ]);

    const anywhere = await service.searchProducts(makeQuery({ sort: "popular" }));
    if (!anywhere.success) throw new Error(anywhere.error.message);
    expect(anywhere.data.items.map((product) => product.id)).toEqual([
      "prd_oak",
      "prd_lamp",
      "prd_smartdesk",
      "prd_chair",
    ]);
  });

  it("falls back to featured, then name, while nothing has been rented", async () => {
    const { service } = setup();

    const result = await service.searchProducts(makeQuery({ sort: "popular" }));
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.items.map((product) => product.id)).toEqual([
      "prd_chair",
      "prd_smartdesk",
      "prd_lamp",
      "prd_oak",
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

  it("reports a read failure instead of throwing, keeping the cause", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    const result = await service.searchProducts(makeQuery());

    expect(result).toMatchObject({
      success: false,
      error: { code: "failed_to_search_products", message: "Failed to search products" },
    });
    // The underlying database error is carried as the cause rather than
    // swallowed, so a failure can be logged with the query that broke.
    if (result.success) throw new Error("expected a failure");
    expect(result.error.cause).toBeDefined();
  });
});

describe("getProductById", () => {
  it("returns one product with its full details", async () => {
    const { service } = setup();

    const result = await service.getProductById({ productId: "prd_smartdesk" });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      id: "prd_smartdesk",
      slug: "smartdesk-pro",
      name: "SmartDesk Pro",
      categoryId: "cat_desks",
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

    await expect(service.getProductById({ productId: "prd_missing" })).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product prd_missing not found" },
    });
  });

  it("does not serve archived products that search hides", async () => {
    const { service } = setup();

    await expect(service.getProductById({ productId: "prd_archived" })).resolves.toEqual({
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

    await expect(service.getProductById({ productId: "prd_imageless" })).resolves.toEqual({
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

    await expect(service.getProductById({ productId: "prd_smartdesk" })).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_fetch_product", message: "Failed to fetch product" },
    });
  });
});

describe("getProductBySlug", () => {
  it("resolves a route slug to the full product", async () => {
    const { service } = setup();

    const result = await service.getProductBySlug({ slug: "smartdesk-pro" });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      id: "prd_smartdesk",
      slug: "smartdesk-pro",
      name: "SmartDesk Pro",
      categoryId: "cat_desks",
    });
  });

  it("looks up the slug column, not the id column", async () => {
    const { service } = setup();

    // A slug that matches no product.
    await expect(service.getProductBySlug({ slug: "missing-desk" })).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product missing-desk not found" },
    });

    // An id is not a slug: prd_smartdesk's slug is smartdesk-pro.
    await expect(service.getProductBySlug({ slug: "prd_smartdesk" })).resolves.toEqual({
      success: false,
      error: { code: "product_not_found", message: "Product prd_smartdesk not found" },
    });
  });

  it("does not serve archived products either, so a deep link to one is dead", async () => {
    const { service } = setup();

    await expect(service.getProductBySlug({ slug: "archived-desk" })).resolves.toEqual({
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

    await expect(service.listLocations()).resolves.toMatchObject({
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

    await expect(service.listCategories()).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_list_categories", message: "Failed to list categories" },
    });
  });
});

describe("isSetup", () => {
  const categories = [
    makeCategory({ id: "cat_setups", slug: "setups", name: "Setups" }),
    makeCategory({ id: "cat_desks", slug: "desks", name: "Desks", sortOrder: 1 }),
  ];

  it("is true for a product in the Setups category", () => {
    expect(isSetup(makeProduct({ categoryId: "cat_setups" }), categories)).toBe(true);
  });

  it("is false for a product in another category", () => {
    expect(isSetup(makeProduct({ categoryId: "cat_desks" }), categories)).toBe(false);
  });

  it("is false when the catalog has no Setups category", () => {
    expect(isSetup(makeProduct({ categoryId: "cat_setups" }), categories.slice(1))).toBe(false);
  });
});

describe("setupParts", () => {
  it("reads the product names from the Includes spec, trimmed, dropping empty entries", () => {
    const setup = makeProduct({
      categoryId: "cat_setups",
      specs: [
        { label: "Delivery", value: "Assembled on site" },
        { label: "Includes", value: ' SmartDesk Pro,Ergonomic Task Chair , , UltraSharp 27" 4K,' },
      ],
    });

    expect(setupParts(setup)).toEqual([
      "SmartDesk Pro",
      "Ergonomic Task Chair",
      'UltraSharp 27" 4K',
    ]);
  });

  it("is empty for a Setup without the Includes spec", () => {
    const setup = makeProduct({
      categoryId: "cat_setups",
      specs: [{ label: "Delivery", value: "Assembled on site" }],
    });

    expect(setupParts(setup)).toEqual([]);
  });
});
