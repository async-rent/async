import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import type { Cart, CartItem, ChargeSummary } from "../types";
import { createCartService } from "./cart";

/** A fixed timestamp, so nothing in a fixture depends on the clock. */
const createdAt = Date.UTC(2026, 0, 1);

interface PriceFixture {
  locationId: string;
  currency?: string;
  weeklyPrice: number;
  deposit?: number;
  deliveryFee?: number;
  stock?: number;
}

interface ProductFixture {
  id: string;
  name: string;
  slug?: string;
  status?: "active" | "archived";
  images?: string[];
  prices?: PriceFixture[];
}

function seedCitiesAndCategories({ sqlite }: TestDatabase): void {
  sqlite.exec(`
    INSERT INTO locations (id, slug, name, country, timezone, description, status) VALUES
      ('loc_bali',   'bali',   'Bali',   'Indonesia', 'Asia/Makassar', 'Canggu and Ubud.', 'active'),
      ('loc_lisbon', 'lisbon', 'Lisbon', 'Portugal',  'Europe/Lisbon', NULL,               'active');

    INSERT INTO categories (id, slug, name, description, sort_order) VALUES
      ('cat_desks', 'desks', 'Desks', 'Standing and fixed desks.', 1);
  `);
}

function insertProduct(database: TestDatabase, fixture: ProductFixture): void {
  const { sqlite } = database;

  sqlite
    .prepare(
      `INSERT INTO products (id, slug, name, tagline, description, category_id, badge, featured, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fixture.id,
      fixture.slug ?? fixture.id,
      fixture.name,
      "A product for the test catalog.",
      "Long-form copy for the product page.",
      "cat_desks",
      null,
      0,
      fixture.status ?? "active",
      createdAt,
    );

  const images = fixture.images ?? [`https://cdn.async.rent/${fixture.id}-0.jpg`];

  images.forEach((url, position) => {
    sqlite
      .prepare("INSERT INTO product_images (product_id, position, url, alt) VALUES (?, ?, ?, ?)")
      .run(fixture.id, position, url, fixture.name);
  });

  for (const price of fixture.prices ?? []) {
    sqlite
      .prepare(
        `INSERT INTO product_prices (product_id, location_id, currency, weekly_price, deposit, delivery_fee, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fixture.id,
        price.locationId,
        price.currency ?? "USD",
        price.weeklyPrice,
        price.deposit ?? null,
        price.deliveryFee ?? null,
        price.stock ?? null,
      );
  }
}

/**
 * A small catalog with deliberately uneven per-item delivery fees, so a test
 * can tell a per-order fee (the highest) from a per-line sum.
 */
function seedCatalog(database: TestDatabase): void {
  seedCitiesAndCategories(database);

  insertProduct(database, {
    id: "prd_smartdesk",
    name: "SmartDesk Pro",
    slug: "smartdesk-pro",
    prices: [
      { locationId: "loc_bali", weeklyPrice: 12000, deposit: 24000, deliveryFee: 5000, stock: 3 },
      { locationId: "loc_lisbon", weeklyPrice: 13000, deposit: 26000, deliveryFee: 1500 },
    ],
  });

  insertProduct(database, {
    id: "prd_chair",
    name: "Ergonomic Task Chair",
    slug: "ergonomic-task-chair",
    prices: [{ locationId: "loc_bali", weeklyPrice: 6000, deposit: 12000, deliveryFee: 2000 }],
  });

  insertProduct(database, {
    id: "prd_lamp",
    name: "Arc Floor Lamp",
    slug: "arc-floor-lamp",
    prices: [{ locationId: "loc_bali", weeklyPrice: 4000, deliveryFee: 1000 }],
  });

  insertProduct(database, {
    id: "prd_archived",
    name: "Archived Desk",
    slug: "archived-desk",
    status: "archived",
    prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
  });

  // The one non-USD row: a cart is single-currency, so it cannot join a USD
  // cart in the same city.
  insertProduct(database, {
    id: "prd_lisbon_desk",
    name: "Lisbon Desk",
    slug: "lisbon-desk",
    prices: [{ locationId: "loc_bali", currency: "EUR", weeklyPrice: 11000 }],
  });
}

function setup() {
  const database = createTestDatabase();
  seedCatalog(database);

  return { ...database, service: createCartService({ db: database.db }) };
}

interface ItemFixture {
  productId: string;
  weeklyPrice: number;
  quantity?: number;
  deposit?: number;
  name?: string;
}

/**
 * A cart as the app would hand it over: lines carry their price snapshot, and
 * the summary is what those lines add up to unless a test overrides a field to
 * break a rule.
 */
function cartFixture(
  input: {
    id?: string;
    customerId?: string;
    locationId?: string;
    currency?: string;
    items?: ItemFixture[];
    deliveryFee?: number;
    discount?: number;
    summary?: Partial<ChargeSummary>;
  } = {},
): Cart {
  const items: CartItem[] = (input.items ?? []).map((item) => {
    const name = item.name ?? item.productId;

    return {
      productId: item.productId,
      name,
      slug: item.productId,
      image: { url: `https://cdn.async.rent/${item.productId}-0.jpg`, alt: name },
      quantity: item.quantity ?? 1,
      weeklyPrice: item.weeklyPrice,
      ...(item.deposit === undefined ? {} : { deposit: item.deposit }),
    };
  });

  const weeklySubtotal = items.reduce((sum, item) => sum + item.weeklyPrice * item.quantity, 0);
  const deposit = items.reduce((sum, item) => sum + (item.deposit ?? 0) * item.quantity, 0);
  const deliveryFee = input.deliveryFee ?? 0;
  const discount = input.discount ?? 0;

  return {
    id: input.id ?? "cart_1",
    ...(input.customerId ? { customerId: input.customerId } : {}),
    locationId: input.locationId ?? "loc_bali",
    items,
    summary: {
      currency: input.currency ?? "USD",
      weeklySubtotal,
      deposit,
      deliveryFee,
      discount,
      totalDueToday: weeklySubtotal + deposit + deliveryFee - discount,
      recurringWeekly: weeklySubtotal,
      ...input.summary,
    },
  };
}

/** A one-line Bali cart: 12000 weekly, 24000 deposit, 5000 delivery. */
function smartdeskCart(overrides: Parameters<typeof cartFixture>[0] = {}): Cart {
  return cartFixture({
    items: [{ productId: "prd_smartdesk", weeklyPrice: 12000, deposit: 24000 }],
    deliveryFee: 5000,
    ...overrides,
  });
}

function storedCartRow({ sqlite }: TestDatabase, cartId: string) {
  return sqlite
    .prepare(
      `SELECT id, customer_id AS customerId, location_id AS locationId, currency,
              weekly_subtotal AS weeklySubtotal, deposit, delivery_fee AS deliveryFee,
              discount, total_due_today AS totalDueToday, recurring_weekly AS recurringWeekly,
              created_at AS createdAt, updated_at AS updatedAt
       FROM carts WHERE id = ?`,
    )
    .get(cartId) as Record<string, unknown> | undefined;
}

function storedCartItems({ sqlite }: TestDatabase, cartId: string) {
  return sqlite
    .prepare(
      `SELECT position, product_id AS productId, name, slug, image_url AS imageUrl,
              image_alt AS imageAlt, quantity, weekly_price AS weeklyPrice, deposit
       FROM cart_items WHERE cart_id = ? ORDER BY position`,
    )
    .all(cartId) as Record<string, unknown>[];
}

describe("createCart", () => {
  it("stores the cart row and its lines", async () => {
    const database = setup();
    const { service } = database;

    const cart = cartFixture({
      id: "cart_1",
      customerId: "user_01",
      items: [
        { productId: "prd_smartdesk", weeklyPrice: 12000, deposit: 24000 },
        { productId: "prd_chair", weeklyPrice: 6000, deposit: 12000, quantity: 2 },
      ],
      deliveryFee: 5000,
    });

    const result = await service.createCart(cart);
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toEqual(cart);

    expect(storedCartRow(database, "cart_1")).toMatchObject({
      customerId: "user_01",
      locationId: "loc_bali",
      currency: "USD",
      weeklySubtotal: 24000,
      deposit: 48000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 77000,
      recurringWeekly: 24000,
    });

    expect(storedCartItems(database, "cart_1")).toEqual([
      {
        position: 0,
        productId: "prd_smartdesk",
        name: "prd_smartdesk",
        slug: "prd_smartdesk",
        imageUrl: "https://cdn.async.rent/prd_smartdesk-0.jpg",
        imageAlt: "prd_smartdesk",
        quantity: 1,
        weeklyPrice: 12000,
        deposit: 24000,
      },
      {
        position: 1,
        productId: "prd_chair",
        name: "prd_chair",
        slug: "prd_chair",
        imageUrl: "https://cdn.async.rent/prd_chair-0.jpg",
        imageAlt: "prd_chair",
        quantity: 2,
        weeklyPrice: 6000,
        deposit: 12000,
      },
    ]);
  });

  it("stores an empty cart", async () => {
    const database = setup();
    const { service } = database;

    const cart = cartFixture({ id: "cart_empty" });
    const result = await service.createCart(cart);
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toEqual(cart);
    expect(storedCartRow(database, "cart_empty")).toMatchObject({
      weeklySubtotal: 0,
      deposit: 0,
      deliveryFee: 0,
      totalDueToday: 0,
      recurringWeekly: 0,
    });
    expect(storedCartItems(database, "cart_empty")).toEqual([]);
  });

  it("rejects an id that is already taken", async () => {
    const { service } = setup();

    const first = await service.createCart(smartdeskCart({ id: "cart_1" }));
    if (!first.success) throw new Error(first.error.message);

    await expect(service.createCart(smartdeskCart({ id: "cart_1" }))).resolves.toEqual({
      success: false,
      error: { code: "cart_already_exists", message: "Cart cart_1 already exists" },
    });
  });

  it("rejects a city that does not exist", async () => {
    const { service } = setup();

    await expect(service.createCart(cartFixture({ locationId: "loc_nowhere" }))).resolves.toEqual({
      success: false,
      error: { code: "location_not_found", message: "Location loc_nowhere not found" },
    });
  });

  it("rejects a product that is not rentable in the city", async () => {
    const { service } = setup();

    // Archived in Bali, and priced only in Bali while the cart is in Lisbon.
    await expect(
      service.createCart(
        cartFixture({ items: [{ productId: "prd_archived", weeklyPrice: 1000 }] }),
      ),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_archived is not available in loc_bali",
      },
    });

    await expect(
      service.createCart(
        cartFixture({
          locationId: "loc_lisbon",
          items: [{ productId: "prd_chair", weeklyPrice: 6000 }],
        }),
      ),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_chair is not available in loc_lisbon",
      },
    });
  });

  it("keeps a cart single-currency", async () => {
    const { service } = setup();

    await expect(
      service.createCart(
        cartFixture({ items: [{ productId: "prd_lisbon_desk", weeklyPrice: 11000 }] }),
      ),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_currency_mismatch",
        message: "Product prd_lisbon_desk is priced in EUR, not USD",
      },
    });
  });

  it("bills delivery once for the order, not per line", async () => {
    const { service } = setup();

    const items: ItemFixture[] = [
      { productId: "prd_smartdesk", weeklyPrice: 12000, deposit: 24000 },
      { productId: "prd_chair", weeklyPrice: 6000, deposit: 12000 },
    ];

    // The fees are 5000 and 2000; a summary that adds them is rejected.
    await expect(service.createCart(cartFixture({ items, deliveryFee: 7000 }))).resolves.toEqual({
      success: false,
      error: {
        code: "cart_summary_mismatch",
        message: "Cart cart_1 summary does not match its lines",
      },
    });

    const result = await service.createCart(cartFixture({ items, deliveryFee: 5000 }));
    expect(result.success).toBe(true);
  });

  it("rejects a summary that does not add up", async () => {
    const { service } = setup();

    await expect(
      service.createCart(smartdeskCart({ summary: { totalDueToday: 41001 } })),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_summary_mismatch",
        message: "Cart cart_1 summary does not match its lines",
      },
    });
  });

  it("reports a lookup failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.createCart(smartdeskCart())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_validate_cart", message: "Failed to validate cart" },
    });
  });
});

describe("updateCart", () => {
  it("replaces the stored lines and summary", async () => {
    const database = setup();
    const { service } = database;

    const created = await service.createCart(
      cartFixture({
        id: "cart_1",
        customerId: "user_01",
        items: [
          { productId: "prd_smartdesk", weeklyPrice: 12000, deposit: 24000 },
          { productId: "prd_chair", weeklyPrice: 6000, deposit: 12000 },
        ],
        deliveryFee: 5000,
      }),
    );
    if (!created.success) throw new Error(created.error.message);

    const updated = cartFixture({
      id: "cart_1",
      customerId: "user_01",
      items: [{ productId: "prd_lamp", weeklyPrice: 4000 }],
      deliveryFee: 1000,
    });

    const result = await service.updateCart(updated);
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toEqual(updated);
    expect(storedCartRow(database, "cart_1")).toMatchObject({
      weeklySubtotal: 4000,
      deposit: 0,
      deliveryFee: 1000,
      totalDueToday: 5000,
      recurringWeekly: 4000,
    });
    expect(storedCartItems(database, "cart_1")).toEqual([
      {
        position: 0,
        productId: "prd_lamp",
        name: "prd_lamp",
        slug: "prd_lamp",
        imageUrl: "https://cdn.async.rent/prd_lamp-0.jpg",
        imageAlt: "prd_lamp",
        quantity: 1,
        weeklyPrice: 4000,
        deposit: null,
      },
    ]);
  });

  it("can empty a cart without dropping the row", async () => {
    const database = setup();
    const { service } = database;

    const created = await service.createCart(smartdeskCart({ id: "cart_1" }));
    if (!created.success) throw new Error(created.error.message);

    const emptied = cartFixture({ id: "cart_1" });
    const result = await service.updateCart(emptied);
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toEqual(emptied);
    expect(storedCartItems(database, "cart_1")).toEqual([]);
    expect(storedCartRow(database, "cart_1")).toMatchObject({
      weeklySubtotal: 0,
      deposit: 0,
      deliveryFee: 0,
      totalDueToday: 0,
    });
  });

  it("keeps the cart's created time and bumps its updated time", async () => {
    const database = setup();
    const { service, sqlite } = database;

    const created = await service.createCart(smartdeskCart({ id: "cart_1" }));
    if (!created.success) throw new Error(created.error.message);

    // A fixed old stamp, so the update has something to preserve.
    sqlite.exec(`UPDATE carts SET created_at = 1000, updated_at = NULL WHERE id = 'cart_1'`);

    const result = await service.updateCart(smartdeskCart({ id: "cart_1", deliveryFee: 5000 }));
    if (!result.success) throw new Error(result.error.message);

    const row = storedCartRow(database, "cart_1");
    expect(row?.createdAt).toBe(1000);
    expect(row?.updatedAt).toBeGreaterThan(1000);
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(service.updateCart(smartdeskCart({ id: "cart_missing" }))).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("revalidates the city when the cart moves", async () => {
    const { service } = setup();

    const created = await service.createCart(smartdeskCart({ id: "cart_1" }));
    if (!created.success) throw new Error(created.error.message);

    // The lamp is sold in Bali only, so a Lisbon cart cannot hold it.
    await expect(
      service.updateCart(
        cartFixture({
          id: "cart_1",
          locationId: "loc_lisbon",
          items: [{ productId: "prd_lamp", weeklyPrice: 4000 }],
        }),
      ),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_lamp is not available in loc_lisbon",
      },
    });
  });

  it("rejects a summary that does not match", async () => {
    const { service } = setup();

    const created = await service.createCart(smartdeskCart({ id: "cart_1" }));
    if (!created.success) throw new Error(created.error.message);

    await expect(
      service.updateCart(smartdeskCart({ id: "cart_1", summary: { deliveryFee: 0 } })),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_summary_mismatch",
        message: "Cart cart_1 summary does not match its lines",
      },
    });
  });

  it("reports a lookup failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.updateCart(smartdeskCart({ id: "cart_1" }))).resolves.toEqual({
      success: false,
      error: { code: "failed_to_validate_cart", message: "Failed to validate cart" },
    });
  });
});
