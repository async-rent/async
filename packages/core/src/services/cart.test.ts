import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
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
    id: "prd_sofa",
    name: "Lounge Sofa",
    slug: "lounge-sofa",
    prices: [{ locationId: "loc_bali", weeklyPrice: 30000, deliveryFee: 8000 }],
  });

  insertProduct(database, {
    id: "prd_archived",
    name: "Archived Desk",
    slug: "archived-desk",
    status: "archived",
    prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
  });

  // The one non-USD row: a cart is single-currency, so adding it to a USD cart
  // must be refused.
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

describe("addItem", () => {
  it("opens a cart and snapshots the line from the city's price", async () => {
    const { service } = setup();

    const result = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.id).toMatch(/^cart_/);
    expect(result.data.locationId).toBe("loc_bali");
    expect(result.data.customerId).toBeUndefined();
    expect(result.data.items).toEqual([
      {
        productId: "prd_smartdesk",
        name: "SmartDesk Pro",
        slug: "smartdesk-pro",
        image: { url: "https://cdn.async.rent/prd_smartdesk-0.jpg", alt: "SmartDesk Pro" },
        quantity: 1,
        weeklyPrice: 12000,
        deposit: 24000,
      },
    ]);
    expect(result.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 12000,
      deposit: 24000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 41000,
      recurringWeekly: 12000,
    });
  });

  it("merges a repeated product into its line", async () => {
    const { service } = setup();

    const first = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!first.success) throw new Error(first.error.message);

    const second = await service.addItem({
      cartId: first.data.id,
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 2,
    });
    if (!second.success) throw new Error(second.error.message);

    expect(second.data.items).toHaveLength(1);
    expect(second.data.items[0]?.quantity).toBe(3);
    expect(second.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 36000,
      deposit: 72000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 113000,
      recurringWeekly: 36000,
    });
  });

  it("sums the weekly price and deposit across lines but bills delivery once", async () => {
    const { service } = setup();

    const first = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!first.success) throw new Error(first.error.message);

    const second = await service.addItem({
      cartId: first.data.id,
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!second.success) throw new Error(second.error.message);

    // 12000 + 6000 = 18000 weekly; 24000 + 12000 = 36000 deposit; the delivery
    // fee is the pricier of the two items (5000), not 5000 + 2000.
    expect(second.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 18000,
      deposit: 36000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 59000,
      recurringWeekly: 18000,
    });

    // A third line with the largest fee still does not stack.
    const third = await service.addItem({
      cartId: first.data.id,
      locationId: "loc_bali",
      productId: "prd_sofa",
      quantity: 1,
    });
    if (!third.success) throw new Error(third.error.message);

    expect(third.data.items.map((item) => item.productId)).toEqual([
      "prd_smartdesk",
      "prd_chair",
      "prd_sofa",
    ]);
    expect(third.data.summary.deliveryFee).toBe(8000);
  });

  it("quotes the totals from the cart's own city", async () => {
    const { service } = setup();

    const result = await service.addItem({
      locationId: "loc_lisbon",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 13000,
      deposit: 26000,
      deliveryFee: 1500,
      discount: 0,
      totalDueToday: 40500,
      recurringWeekly: 13000,
    });
  });

  it("refuses a product that is not rentable in the city", async () => {
    const { service } = setup();

    await expect(
      service.addItem({ locationId: "loc_bali", productId: "prd_archived", quantity: 1 }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_archived is not available in loc_bali",
      },
    });

    await expect(
      service.addItem({ locationId: "loc_lisbon", productId: "prd_chair", quantity: 1 }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_chair is not available in loc_lisbon",
      },
    });
  });

  it("never mixes a second city into a cart", async () => {
    const { service } = setup();

    const first = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!first.success) throw new Error(first.error.message);

    await expect(
      service.addItem({
        cartId: first.data.id,
        locationId: "loc_lisbon",
        productId: "prd_smartdesk",
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_city_mismatch",
        message: `Cart ${first.data.id} is for another city`,
      },
    });

    const added = await service.addItem({
      cartId: first.data.id,
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);
    expect(added.data.items.map((item) => item.productId)).toEqual(["prd_smartdesk", "prd_chair"]);
  });

  it("keeps a cart single-currency", async () => {
    const { service } = setup();

    // A cart opened on a EUR price is fine; the currency comes from the offer.
    const euro = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_lisbon_desk",
      quantity: 1,
    });
    if (!euro.success) throw new Error(euro.error.message);
    expect(euro.data.summary.currency).toBe("EUR");

    // But a USD cart cannot take a EUR line.
    const usd = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!usd.success) throw new Error(usd.error.message);

    await expect(
      service.addItem({
        cartId: usd.data.id,
        locationId: "loc_bali",
        productId: "prd_lisbon_desk",
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_currency_mismatch",
        message: `Cart ${usd.data.id} is priced in USD`,
      },
    });
  });

  it("reuses a signed-in visitor's cart for the city", async () => {
    const { service } = setup();

    const first = await service.addItem({
      customerId: "user_01",
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!first.success) throw new Error(first.error.message);

    const second = await service.addItem({
      customerId: "user_01",
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!second.success) throw new Error(second.error.message);

    expect(second.data.id).toBe(first.data.id);
    expect(second.data.customerId).toBe("user_01");
    expect(second.data.items.map((item) => item.productId)).toEqual(["prd_lamp", "prd_chair"]);
  });

  it("keeps guest carts apart", async () => {
    const { service } = setup();

    const first = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    const second = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!first.success || !second.success) throw new Error("add failed");

    expect(first.data.id).not.toBe(second.data.id);
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(
      service.addItem({
        cartId: "cart_missing",
        locationId: "loc_bali",
        productId: "prd_smartdesk",
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(
      service.addItem({
        cartId: "cart_any",
        locationId: "loc_bali",
        productId: "prd_smartdesk",
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_cart", message: "Failed to fetch cart" },
    });
  });

  it("reports invalid data from a write instead of throwing", async () => {
    const { service, sqlite } = setup();

    // The DB's `>= 0` check allows a fractional price, but `amountSchema`
    // requires whole minor units — so the write lands and the shaped cart is
    // what the domain schema rejects.
    sqlite.exec(
      `UPDATE product_prices SET weekly_price = 1.5 WHERE product_id = 'prd_smartdesk' AND location_id = 'loc_bali'`,
    );

    await expect(
      service.addItem({ locationId: "loc_bali", productId: "prd_smartdesk", quantity: 1 }),
    ).resolves.toEqual({
      success: false,
      error: { code: "cart_data_invalid", message: expect.stringContaining("has invalid data") },
    });
  });
});

describe("updateItemQuantity", () => {
  it("sets an exact quantity and re-totals", async () => {
    const { service } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    const result = await service.updateItemQuantity({
      cartId: added.data.id,
      productId: "prd_smartdesk",
      quantity: 2,
    });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.items[0]?.quantity).toBe(2);
    expect(result.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 24000,
      deposit: 48000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 77000,
      recurringWeekly: 24000,
    });
  });

  it("fails when the line is not in the cart", async () => {
    const { service } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    await expect(
      service.updateItemQuantity({
        cartId: added.data.id,
        productId: "prd_chair",
        quantity: 2,
      }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_item_not_found",
        message: `Product prd_chair is not in cart ${added.data.id}`,
      },
    });
  });

  it("fails on a cart that does not exist", async () => {
    const { service } = setup();

    await expect(
      service.updateItemQuantity({ cartId: "cart_missing", productId: "prd_chair", quantity: 2 }),
    ).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(
      service.updateItemQuantity({ cartId: "cart_any", productId: "prd_chair", quantity: 1 }),
    ).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_cart", message: "Failed to fetch cart" },
    });
  });
});

describe("removeItem", () => {
  it("removes a line and re-totals", async () => {
    const { service } = setup();

    const first = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!first.success) throw new Error(first.error.message);
    const second = await service.addItem({
      cartId: first.data.id,
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!second.success) throw new Error(second.error.message);

    const result = await service.removeItem({
      cartId: second.data.id,
      productId: "prd_chair",
    });
    if (!result.success) throw new Error(result.error.message);

    expect(result.data.items.map((item) => item.productId)).toEqual(["prd_smartdesk"]);
    expect(result.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 12000,
      deposit: 24000,
      deliveryFee: 5000,
      discount: 0,
      totalDueToday: 41000,
      recurringWeekly: 12000,
    });
  });

  it("leaves an empty cart rather than dropping it", async () => {
    const { service } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    const removed = await service.removeItem({
      cartId: added.data.id,
      productId: "prd_lamp",
    });
    if (!removed.success) throw new Error(removed.error.message);

    expect(removed.data.id).toBe(added.data.id);
    expect(removed.data.items).toEqual([]);
    expect(removed.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 0,
      deposit: 0,
      deliveryFee: 0,
      discount: 0,
      totalDueToday: 0,
      recurringWeekly: 0,
    });

    // The empty cart is still readable under the same id.
    const read = await service.getCart(added.data.id);
    if (!read.success) throw new Error(read.error.message);
    expect(read.data.items).toEqual([]);
  });

  it("fails when the line is not in the cart", async () => {
    const { service } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    await expect(
      service.removeItem({ cartId: added.data.id, productId: "prd_chair" }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_item_not_found",
        message: `Product prd_chair is not in cart ${added.data.id}`,
      },
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(
      service.removeItem({ cartId: "cart_any", productId: "prd_chair" }),
    ).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_cart", message: "Failed to fetch cart" },
    });
  });
});

describe("getCart", () => {
  it("returns the persisted cart and its stored summary", async () => {
    const { service } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    const result = await service.getCart(added.data.id);
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      id: added.data.id,
      locationId: "loc_bali",
      summary: { weeklySubtotal: 12000, totalDueToday: 41000 },
    });
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(service.getCart("cart_missing")).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("reports a read failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.getCart("cart_any")).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_cart", message: "Failed to fetch cart" },
    });
  });

  it("returns an invalid-data failure instead of throwing on a broken row", async () => {
    const { service, sqlite } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);

    // A row the DB accepts but the domain schema rejects: a fractional amount
    // still satisfies `>= 0`, yet `amountSchema` requires whole minor units.
    sqlite.exec(`UPDATE cart_items SET weekly_price = 1.5 WHERE cart_id = '${added.data.id}'`);

    await expect(service.getCart(added.data.id)).resolves.toEqual({
      success: false,
      error: { code: "cart_data_invalid", message: `Cart ${added.data.id} has invalid data` },
    });
  });

  it("keeps one total when a city's delivery fee changes", async () => {
    const { service, sqlite } = setup();

    const added = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!added.success) throw new Error(added.error.message);
    expect(added.data.summary).toMatchObject({ deliveryFee: 5000, totalDueToday: 41000 });

    // The delivery fee is not snapshotted on a line, so a read must recompute
    // it: the stored row and a later write must never quote two different totals.
    sqlite.exec(
      `UPDATE product_prices SET delivery_fee = 9000 WHERE product_id = 'prd_smartdesk' AND location_id = 'loc_bali'`,
    );

    const read = await service.getCart(added.data.id);
    if (!read.success) throw new Error(read.error.message);
    expect(read.data.summary).toMatchObject({ deliveryFee: 9000, totalDueToday: 45000 });

    const merged = await service.addItem({
      cartId: added.data.id,
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!merged.success) throw new Error(merged.error.message);

    // 12000 + 4000 weekly, 24000 deposit, max(9000, 1000) delivery.
    expect(merged.data.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 16000,
      deposit: 24000,
      deliveryFee: 9000,
      discount: 0,
      totalDueToday: 49000,
      recurringWeekly: 16000,
    });
  });
});

describe("cart ownership and concurrent adds", () => {
  it("claims an unowned cart for a signed-in visitor", async () => {
    const { service } = setup();

    const guest = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!guest.success) throw new Error(guest.error.message);
    expect(guest.data.customerId).toBeUndefined();

    const claimed = await service.addItem({
      cartId: guest.data.id,
      customerId: "user_01",
      locationId: "loc_bali",
      productId: "prd_chair",
      quantity: 1,
    });
    if (!claimed.success) throw new Error(claimed.error.message);
    expect(claimed.data.customerId).toBe("user_01");

    // A later add without a cart id finds the now-owned cart, not a second one.
    const again = await service.addItem({
      customerId: "user_01",
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!again.success) throw new Error(again.error.message);
    expect(again.data.id).toBe(guest.data.id);
  });

  it("refuses a cart owned by another customer", async () => {
    const { service } = setup();

    const owned = await service.addItem({
      customerId: "user_01",
      locationId: "loc_bali",
      productId: "prd_lamp",
      quantity: 1,
    });
    if (!owned.success) throw new Error(owned.error.message);

    await expect(
      service.addItem({
        cartId: owned.data.id,
        customerId: "user_02",
        locationId: "loc_bali",
        productId: "prd_chair",
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: {
        code: "cart_forbidden",
        message: `Cart ${owned.data.id} belongs to another customer`,
      },
    });
  });

  it("lands both of two overlapping adds of the same product", async () => {
    const { service } = setup();

    const cart = await service.addItem({
      locationId: "loc_bali",
      productId: "prd_smartdesk",
      quantity: 1,
    });
    if (!cart.success) throw new Error(cart.error.message);

    // Both calls read the cart before either writes, so both try to open the
    // same line; the loser retries and merges.
    const results = await Promise.all([
      service.addItem({
        cartId: cart.data.id,
        locationId: "loc_bali",
        productId: "prd_lamp",
        quantity: 1,
      }),
      service.addItem({
        cartId: cart.data.id,
        locationId: "loc_bali",
        productId: "prd_lamp",
        quantity: 1,
      }),
    ]);

    expect(results.every((result) => result.success)).toBe(true);

    const read = await service.getCart(cart.data.id);
    if (!read.success) throw new Error(read.error.message);
    expect(read.data.items.find((item) => item.productId === "prd_lamp")?.quantity).toBe(2);
  });
});
