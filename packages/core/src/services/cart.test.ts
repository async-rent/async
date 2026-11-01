import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import type { Cart, CartLine } from "../schemas";
import { maxCartLines } from "../schemas";
import { cartLineError, cartQuantityError, createCartService, isCartItemAvailable } from "./cart";
import { createPricingService } from "./pricing";

const createdAt = Date.UTC(2026, 0, 1);

interface PriceFixture {
  locationId: string;
  weeklyPrice: number;
  deposit?: number;
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

function seedCities({ sqlite }: TestDatabase): void {
  sqlite.exec(`
    INSERT INTO locations (id, slug, name, country, timezone, description, currency, delivery_fee, status) VALUES
      ('loc_bali',    'bali',    'Bali',    'Indonesia', 'Asia/Makassar', 'Canggu and Ubud desks.', 'USD', 1000, 'active'),
      ('loc_lisbon',  'lisbon',  'Lisbon',  'Portugal',  'Europe/Lisbon', NULL,                     'USD', 1500, 'active'),
      ('loc_ko_tao',  'ko-tao',  'Ko Tao',  'Thailand', 'Asia/Bangkok',  'Opening next season.',   'USD',  500, 'coming_soon');

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

function seedCatalog(database: TestDatabase): void {
  seedCities(database);

  insertProduct(database, {
    id: "prd_smartdesk",
    name: "SmartDesk Pro",
    slug: "smartdesk-pro",
    prices: [
      { locationId: "loc_bali", weeklyPrice: 12000, deposit: 24000, stock: 3 },
      { locationId: "loc_lisbon", weeklyPrice: 13000, deposit: 26000 },
    ],
  });

  insertProduct(database, {
    id: "prd_chair",
    name: "Ergonomic Task Chair",
    slug: "ergonomic-task-chair",
    prices: [{ locationId: "loc_bali", weeklyPrice: 6000, deposit: 12000 }],
  });

  insertProduct(database, {
    id: "prd_lamp",
    name: "Arc Floor Lamp",
    slug: "arc-floor-lamp",
    prices: [{ locationId: "loc_bali", weeklyPrice: 4000 }],
  });

  insertProduct(database, {
    id: "prd_archived",
    name: "Archived Desk",
    slug: "archived-desk",
    status: "archived",
    prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
  });
}

function setup() {
  const database = createTestDatabase();
  seedCatalog(database);

  return {
    ...database,
    service: createCartService({ db: database.db, pricing: createPricingService() }),
  };
}

const userId = "user_01";
const otherUserId = "user_02";

function cartOf(result: { success: boolean; data?: Cart; error?: { message: string } }): Cart {
  if (!result.success || !result.data) throw new Error(result.error?.message);

  return result.data;
}

async function openCart(
  service: ReturnType<typeof createCartService>,
  userId: string,
  locationId: string,
): Promise<Cart> {
  return cartOf(await service.getCartByUserAndLocation({ userId, locationId }));
}

async function after(
  service: ReturnType<typeof createCartService>,
  cartId: string,
  change: Promise<{ success: boolean }>,
): Promise<Cart> {
  const result = await change;
  if (!result.success) throw new Error("the change failed");

  return cartOf(await service.getCartById({ cartId }));
}

const lines = (cart: Cart) => cart.items.map((item) => [item.productId, item.quantity]);

describe("getCartByUserAndLocation", () => {
  it("creates an empty cart on the first read", async () => {
    const { service, sqlite } = setup();

    const cart = await openCart(service, userId, "loc_bali");

    expect(cart).toEqual({
      id: expect.any(String),
      userId,
      locationId: "loc_bali",
      currency: "USD",
      items: [],
      summary: {
        currency: "USD",
        weeklySubtotal: 0,
        deposit: 0,
        deliveryFee: 0,
        discount: 0,
        totalDueToday: 0,
      },
    });
    expect(sqlite.prepare("SELECT count(*) AS n FROM carts").get()).toEqual({ n: 1 });
  });

  it("keeps a cart per city", async () => {
    const { service } = setup();
    const bali = await openCart(service, userId, "loc_bali");
    const lisbon = await openCart(service, userId, "loc_lisbon");

    await service.putItem({ cartId: bali.id, productId: "prd_chair", quantity: 1 });
    await service.putItem({ cartId: lisbon.id, productId: "prd_smartdesk", quantity: 1 });

    expect(lines(await openCart(service, userId, "loc_bali"))).toEqual([["prd_chair", 1]]);
    expect(lines(await openCart(service, userId, "loc_lisbon"))).toEqual([["prd_smartdesk", 1]]);
  });

  it("keeps one visitor's cart apart from another's", async () => {
    const { service } = setup();
    const mine = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: mine.id, productId: "prd_chair", quantity: 1 });

    expect((await openCart(service, otherUserId, "loc_bali")).items).toEqual([]);
    expect(lines(await openCart(service, userId, "loc_bali"))).toEqual([["prd_chair", 1]]);
  });

  it("fails when the city does not exist", async () => {
    const { service } = setup();

    await expect(
      service.getCartByUserAndLocation({ userId, locationId: "loc_nowhere" }),
    ).resolves.toEqual({
      success: false,
      error: { code: "location_not_found", message: "Location loc_nowhere not found" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(
      service.getCartByUserAndLocation({ userId, locationId: "loc_bali" }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_cart", message: "Failed to load cart" },
    });
  });

  it("reads in two round trips, however many lines the cart holds", async () => {
    const context = setup();
    const cart = await openCart(context.service, userId, "loc_bali");

    for (let index = 0; index < 10; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });
      await context.service.putItem({
        cartId: cart.id,
        productId: `prd_filler_${index}`,
        quantity: 1,
      });
    }

    const before = context.roundTrips();
    await context.service.getCartByUserAndLocation({ userId, locationId: "loc_bali" });

    expect(context.roundTrips() - before).toBe(2);
  });
});

describe("getCartById", () => {
  it("reads the cart it names", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 2 });

    const read = cartOf(await service.getCartById({ cartId: cart.id }));

    expect(read.id).toBe(cart.id);
    expect(read.userId).toBe(userId);
    expect(lines(read)).toEqual([["prd_chair", 2]]);
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(service.getCartById({ cartId: "cart_missing" })).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.getCartById({ cartId: "cart_any" })).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_cart", message: "Failed to load cart" },
    });
  });
});

describe("putItem", () => {
  it("puts a product in the cart at the quantity asked for", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_smartdesk", quantity: 2 }),
    );

    expect(updated.items).toEqual([
      {
        productId: "prd_smartdesk",
        name: "SmartDesk Pro",
        slug: "smartdesk-pro",
        images: [{ url: "https://cdn.async.rent/prd_smartdesk-0.jpg", alt: "SmartDesk Pro" }],
        quantity: 2,
        weeklyPrice: 12000,
        deposit: 24000,
        available: true,
      },
    ]);
    expect(updated.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 24000,
      deposit: 48000,
      deliveryFee: 1000,
      discount: 0,
      totalDueToday: 73000,
    });
  });

  it("shows every photo of the product, in order", async () => {
    const context = setup();
    const cart = await openCart(context.service, userId, "loc_bali");

    insertProduct(context, {
      id: "prd_monitor",
      name: "Monitor",
      images: ["https://cdn.async.rent/a.jpg", "https://cdn.async.rent/b.jpg"],
      prices: [{ locationId: "loc_bali", weeklyPrice: 5000 }],
    });
    await context.service.putItem({
      cartId: cart.id,
      productId: "prd_monitor",
      quantity: 1,
    });
    await context.service.putItem({
      cartId: cart.id,
      productId: "prd_chair",
      quantity: 1,
    });

    const read = cartOf(await context.service.getCartById({ cartId: cart.id }));

    expect(read.items.map((item) => item.images.map((image) => image.url))).toEqual([
      ["https://cdn.async.rent/prd_chair-0.jpg"],
      ["https://cdn.async.rent/a.jpg", "https://cdn.async.rent/b.jpg"],
    ]);
    expect(read.items.map((item) => item.quantity)).toEqual([1, 1]);
  });

  it("replaces the quantity of a line that is already there", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 2 });
    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 5 }),
    );

    expect(lines(updated)).toEqual([["prd_chair", 5]]);
  });

  it("takes the line out when the quantity is zero", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 2 });
    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 0 }),
    );

    expect(updated.items).toEqual([]);
  });

  it("changes nothing when taking out a product that is not in the cart", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 });
    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_lamp", quantity: 0 }),
    );

    expect(lines(updated)).toEqual([["prd_chair", 1]]);
  });

  it("charges delivery once for the order, not per line", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 });
    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_lamp", quantity: 1 }),
    );

    expect(updated.summary.deliveryFee).toBe(1000);
  });

  it("reads and writes in two round trips", async () => {
    const context = setup();
    const cart = await openCart(context.service, userId, "loc_bali");

    const before = context.roundTrips();
    await context.service.putItem({
      cartId: cart.id,
      productId: "prd_chair",
      quantity: 1,
    });

    expect(context.roundTrips() - before).toBe(2);
  });

  it("refuses a product the city does not rent", async () => {
    const { service } = setup();
    const lisbon = await openCart(service, userId, "loc_lisbon");
    const bali = await openCart(service, userId, "loc_bali");

    await expect(
      service.putItem({ cartId: lisbon.id, productId: "prd_chair", quantity: 1 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "product_not_available" },
    });
    await expect(
      service.putItem({ cartId: bali.id, productId: "prd_archived", quantity: 1 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "product_not_available" },
    });
  });

  it("refuses a cart that does not exist", async () => {
    const { service } = setup();

    await expect(
      service.putItem({ cartId: "cart_missing", productId: "prd_chair", quantity: 1 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "cart_not_found" },
    });
  });

  it("refuses a city that is not open yet", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_ko_tao");

    await expect(
      service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "location_not_available" },
    });
  });

  it("refuses more units than the city has left", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await expect(
      service.putItem({ cartId: cart.id, productId: "prd_smartdesk", quantity: 4 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "product_out_of_stock" },
    });

    await service.putItem({
      cartId: cart.id,
      productId: "prd_smartdesk",
      quantity: 2,
    });

    await expect(
      service.putItem({ cartId: cart.id, productId: "prd_smartdesk", quantity: 4 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "product_out_of_stock" },
    });
  });

  it("refuses a quantity that is not a whole number of units", async () => {
    const { service } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    for (const quantity of [-1, 1.5, 31, Number.NaN]) {
      await expect(
        service.putItem({
          cartId: cart.id,
          productId: "prd_chair",
          quantity: quantity,
        }),
      ).resolves.toMatchObject({ success: false, error: { code: "invalid_quantity" } });
    }
  });

  it("refuses a new kind of gear once the cart is full", async () => {
    const context = setup();
    const cart = await openCart(context.service, userId, "loc_bali");

    for (let index = 0; index < 25; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });
      await context.service.putItem({
        cartId: cart.id,
        productId: `prd_filler_${index}`,
        quantity: 1,
      });
    }

    await expect(
      context.service.putItem({
        cartId: cart.id,
        productId: "prd_chair",
        quantity: 1,
      }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "cart_is_full" },
    });
    // A product already in the cart is not a new kind of gear.
    await expect(
      context.service.putItem({
        cartId: cart.id,
        productId: "prd_filler_0",
        quantity: 2,
      }),
    ).resolves.toMatchObject({ success: true });
  });

  it("reports a failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    const cart = await openCart(service, userId, "loc_bali");
    sqlite.close();

    await expect(
      service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_cart" },
    });
  });
});

describe("clearCart", () => {
  it("empties the cart in that city only", async () => {
    const { service } = setup();
    const bali = await openCart(service, userId, "loc_bali");
    const lisbon = await openCart(service, userId, "loc_lisbon");

    await service.putItem({ cartId: bali.id, productId: "prd_chair", quantity: 1 });
    await service.putItem({
      cartId: lisbon.id,
      productId: "prd_smartdesk",
      quantity: 1,
    });
    const cleared = await after(service, bali.id, service.clearCart({ cartId: bali.id }));

    expect(cleared.items).toEqual([]);
    expect(lines(cartOf(await service.getCartById({ cartId: lisbon.id })))).toEqual([
      ["prd_smartdesk", 1],
    ]);
  });

  it("succeeds for a cart that does not exist", async () => {
    const { service } = setup();

    await expect(service.clearCart({ cartId: "cart_missing" })).resolves.toEqual({
      success: true,
    });
  });
});

describe("a cart that outlives a catalog edit", () => {
  it("keeps a line the city no longer offers, but stops pricing it", async () => {
    const { service, sqlite } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 });
    sqlite.exec("DELETE FROM product_prices WHERE product_id = 'prd_chair'");

    const read = cartOf(await service.getCartById({ cartId: cart.id }));

    expect(read.items).toMatchObject([
      { productId: "prd_chair", weeklyPrice: 0, available: false },
    ]);
    expect(read.summary.weeklySubtotal).toBe(0);
    expect(read.summary.totalDueToday).toBe(0);
  });

  it("marks a line whose product was archived as unavailable", async () => {
    const { service, sqlite } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 });
    sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_chair'");

    const read = cartOf(await service.getCartById({ cartId: cart.id }));

    expect(read.items).toMatchObject([{ available: false }]);
    expect(read.summary.totalDueToday).toBe(0);
  });

  it("lets the visitor take such a line out", async () => {
    const { service, sqlite } = setup();
    const cart = await openCart(service, userId, "loc_bali");

    await service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 1 });
    sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_chair'");

    const updated = await after(
      service,
      cart.id,
      service.putItem({ cartId: cart.id, productId: "prd_chair", quantity: 0 }),
    );

    expect(updated.items).toEqual([]);
  });
});

describe("cartQuantityError", () => {
  it("accepts a whole number of units in range", () => {
    for (const quantity of [0, 1, 30]) {
      expect(cartQuantityError(quantity)).toBeNull();
    }
  });

  it("rejects anything else", () => {
    for (const quantity of [-1, 1.5, 31, Number.NaN]) {
      expect(cartQuantityError(quantity)).toBe("invalid_quantity");
    }
  });
});

describe("cartLineError", () => {
  const lines: CartLine[] = [{ productId: "prd_chair", quantity: 1 }];

  it("allows removing a line without checking stock or limits", () => {
    expect(cartLineError({ lines: [], productId: "prd_chair", quantity: 0, stock: 0 })).toBeNull();
  });

  it("refuses more units than the city has left", () => {
    expect(cartLineError({ lines: [], productId: "prd_desk", quantity: 4, stock: 3 })).toBe(
      "product_out_of_stock",
    );
  });

  it("refuses a new line once the cart is full", () => {
    const full = Array.from({ length: maxCartLines }, (_, index) => ({
      productId: `prd_${index}`,
      quantity: 1,
    }));

    expect(cartLineError({ lines: full, productId: "prd_new", quantity: 1, stock: null })).toBe(
      "cart_is_full",
    );

    expect(cartLineError({ lines: full, productId: "prd_0", quantity: 2, stock: null })).toBeNull();
  });

  it("checks the quantity before the cart state", () => {
    expect(cartLineError({ lines, productId: "prd_chair", quantity: 31, stock: 100 })).toBe(
      "invalid_quantity",
    );
  });
});

describe("isCartItemAvailable", () => {
  it("needs an active product that the city still prices", () => {
    expect(isCartItemAvailable("active", true)).toBe(true);
    expect(isCartItemAvailable("active", false)).toBe(false);
    expect(isCartItemAvailable("archived", true)).toBe(false);
  });
});
