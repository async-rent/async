import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import type { Cart, CartOwner } from "../types";
import { createCartService } from "./cart";

/**
 * A fixed timestamp, so nothing in a fixture depends on the clock.
 */
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

/**
 * A small catalog: a desk and a chair in Bali, a chair in Lisbon, a lamp that
 * only Bali sells, and a product that is archived.
 */
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

  return { ...database, service: createCartService({ db: database.db }) };
}

const user: CartOwner = { kind: "user", userId: "user_01" };
const guest: CartOwner = { kind: "guest", token: "a-token-long-enough-to-be-real" };

/** Unwraps a cart result, so a test reads like the visitor's story. */
function cartOf(result: { success: boolean; data?: Cart; error?: { message: string } }): Cart {
  if (!result.success || !result.data) throw new Error(result.error?.message);

  return result.data;
}

/** Runs a change, then reads the cart the visitor sees afterwards. */
async function after(
  service: ReturnType<typeof createCartService>,
  owner: CartOwner,
  locationId: string,
  change: Promise<{ success: boolean }>,
): Promise<Cart> {
  const result = await change;
  if (!result.success) throw new Error("the change failed");

  return cartOf(await service.getCart(owner, locationId));
}

const lines = (cart: Cart) => cart.items.map((item) => [item.productId, item.quantity]);

describe("getCart", () => {
  it("is empty before the first item, and writes nothing", async () => {
    const { service, sqlite } = setup();

    const cart = cartOf(await service.getCart(user, "loc_bali"));

    expect(cart).toEqual({
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
    expect(sqlite.prepare("SELECT count(*) AS n FROM carts").get()).toEqual({ n: 0 });
  });

  it("keeps a cart per city", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    await service.addItem(user, "loc_lisbon", "prd_smartdesk");

    expect(lines(cartOf(await service.getCart(user, "loc_bali")))).toEqual([["prd_chair", 1]]);
    expect(lines(cartOf(await service.getCart(user, "loc_lisbon")))).toEqual([
      ["prd_smartdesk", 1],
    ]);
  });

  it("keeps a guest's cart apart from a visitor's", async () => {
    const { service } = setup();

    await service.addItem(guest, "loc_bali", "prd_chair");

    expect(cartOf(await service.getCart(user, "loc_bali")).items).toEqual([]);
    expect(lines(cartOf(await service.getCart(guest, "loc_bali")))).toEqual([["prd_chair", 1]]);
  });

  it("never stores the guest's token itself", async () => {
    const { service, sqlite } = setup();

    await service.addItem(guest, "loc_bali", "prd_chair");

    const row = sqlite.prepare("SELECT owner_type, owner_id FROM carts").get() as {
      owner_type: string;
      owner_id: string;
    };

    expect(row.owner_type).toBe("guest");
    expect(row.owner_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails when the city does not exist", async () => {
    const { service } = setup();

    await expect(service.getCart(user, "loc_nowhere")).resolves.toEqual({
      success: false,
      error: { code: "location_not_found", message: "Location loc_nowhere not found" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.getCart(user, "loc_bali")).resolves.toEqual({
      success: false,
      error: { code: "failed_to_load_cart", message: "Failed to load cart" },
    });
  });

  it("reads in one round trip, however many lines the cart holds", async () => {
    const context = setup();

    for (let index = 0; index < 10; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });
      await context.service.addItem(user, "loc_bali", `prd_filler_${index}`);
    }

    const before = context.roundTrips();
    await context.service.getCart(user, "loc_bali");

    expect(context.roundTrips() - before).toBe(1);
  });
});

describe("addItem", () => {
  it("returns the cart, priced from the city", async () => {
    const { service } = setup();

    const cart = await after(
      service,
      user,
      "loc_bali",
      service.addItem(user, "loc_bali", "prd_smartdesk", 2),
    );

    expect(cart.items).toEqual([
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
    expect(cart.summary).toEqual({
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

    insertProduct(context, {
      id: "prd_monitor",
      name: "Monitor",
      images: ["https://cdn.async.rent/a.jpg", "https://cdn.async.rent/b.jpg"],
      prices: [{ locationId: "loc_bali", weeklyPrice: 5000 }],
    });
    await context.service.addItem(user, "loc_bali", "prd_monitor");
    await context.service.addItem(user, "loc_bali", "prd_chair");

    const cart = cartOf(await context.service.getCart(user, "loc_bali"));

    expect(cart.items.map((item) => item.images.map((image) => image.url))).toEqual([
      ["https://cdn.async.rent/prd_chair-0.jpg"],
      ["https://cdn.async.rent/a.jpg", "https://cdn.async.rent/b.jpg"],
    ]);
    expect(cart.items.map((item) => item.quantity)).toEqual([1, 1]);
  });

  it("adds to a line that is already in the cart", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.addItem(user, "loc_bali", "prd_chair", 2),
    );

    expect(lines(cart)).toEqual([["prd_chair", 3]]);
  });

  it("charges delivery once for the order, not per line", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.addItem(user, "loc_bali", "prd_lamp"),
    );

    expect(cart.summary.deliveryFee).toBe(1000);
  });

  it("reads and writes in two round trips", async () => {
    const context = setup();

    const before = context.roundTrips();
    await context.service.addItem(user, "loc_bali", "prd_chair");

    expect(context.roundTrips() - before).toBe(2);
  });

  it("refuses a product the city does not rent", async () => {
    const { service } = setup();

    await expect(service.addItem(user, "loc_lisbon", "prd_chair")).resolves.toMatchObject({
      success: false,
      error: { code: "product_not_available" },
    });
    await expect(service.addItem(user, "loc_bali", "prd_archived")).resolves.toMatchObject({
      success: false,
      error: { code: "product_not_available" },
    });
  });

  it("refuses a city that does not exist or is not open yet", async () => {
    const { service } = setup();

    await expect(service.addItem(user, "loc_nowhere", "prd_chair")).resolves.toMatchObject({
      success: false,
      error: { code: "location_not_found" },
    });
    await expect(service.addItem(user, "loc_ko_tao", "prd_chair")).resolves.toMatchObject({
      success: false,
      error: { code: "location_not_available" },
    });
  });

  it("refuses more units than the city has left, counting the ones already held", async () => {
    const { service } = setup();

    await expect(service.addItem(user, "loc_bali", "prd_smartdesk", 4)).resolves.toMatchObject({
      success: false,
      error: { code: "product_out_of_stock" },
    });

    await service.addItem(user, "loc_bali", "prd_smartdesk", 2);

    await expect(service.addItem(user, "loc_bali", "prd_smartdesk", 2)).resolves.toMatchObject({
      success: false,
      error: { code: "product_out_of_stock" },
    });
  });

  it("refuses a quantity that is not a whole number of units", async () => {
    const { service } = setup();

    for (const quantity of [0, -1, 1.5, 31, Number.NaN]) {
      await expect(service.addItem(user, "loc_bali", "prd_chair", quantity)).resolves.toMatchObject(
        { success: false, error: { code: "invalid_quantity" } },
      );
    }
  });

  it("refuses to hold more units of a product than a cart can", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair", 20);

    await expect(service.addItem(user, "loc_bali", "prd_chair", 11)).resolves.toMatchObject({
      success: false,
      error: { code: "invalid_quantity" },
    });
  });

  it("refuses a new kind of gear once the cart is full", async () => {
    const context = setup();

    for (let index = 0; index < 25; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });
      await context.service.addItem(user, "loc_bali", `prd_filler_${index}`);
    }

    await expect(context.service.addItem(user, "loc_bali", "prd_chair")).resolves.toMatchObject({
      success: false,
      error: { code: "cart_is_full" },
    });
    // A product already in the cart is not a new kind of gear.
    await expect(context.service.addItem(user, "loc_bali", "prd_filler_0")).resolves.toMatchObject({
      success: true,
    });
  });

  it("reports a failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.addItem(user, "loc_bali", "prd_chair")).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_cart" },
    });
  });
});

describe("setItemQuantity", () => {
  it("sets the units of a line", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair", 5);
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.setItemQuantity(user, "loc_bali", "prd_chair", 2),
    );

    expect(lines(cart)).toEqual([["prd_chair", 2]]);
  });

  it("removes the line when the quantity is zero", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.setItemQuantity(user, "loc_bali", "prd_chair", 0),
    );

    expect(cart.items).toEqual([]);
  });

  it("refuses more units than the city has left", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_smartdesk");

    await expect(
      service.setItemQuantity(user, "loc_bali", "prd_smartdesk", 4),
    ).resolves.toMatchObject({ success: false, error: { code: "product_out_of_stock" } });
  });

  it("refuses a negative or fractional quantity", async () => {
    const { service } = setup();

    for (const quantity of [-1, 0.5, 31]) {
      await expect(
        service.setItemQuantity(user, "loc_bali", "prd_chair", quantity),
      ).resolves.toMatchObject({ success: false, error: { code: "invalid_quantity" } });
    }
  });
});

describe("removeItem", () => {
  it("takes a product out and keeps the rest", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    await service.addItem(user, "loc_bali", "prd_lamp");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.removeItem(user, "loc_bali", "prd_chair"),
    );

    expect(lines(cart)).toEqual([["prd_lamp", 1]]);
  });

  it("changes nothing when the product is not in the cart", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.removeItem(user, "loc_bali", "prd_lamp"),
    );

    expect(lines(cart)).toEqual([["prd_chair", 1]]);
  });

  it("never touches another owner's cart", async () => {
    const { service } = setup();

    await service.addItem(guest, "loc_bali", "prd_chair");
    await service.removeItem(user, "loc_bali", "prd_chair");

    expect(lines(cartOf(await service.getCart(guest, "loc_bali")))).toEqual([["prd_chair", 1]]);
  });
});

describe("clearCart", () => {
  it("empties the cart in that city only", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    await service.addItem(user, "loc_lisbon", "prd_smartdesk");
    const cart = await after(service, user, "loc_bali", service.clearCart(user, "loc_bali"));

    expect(cart.items).toEqual([]);
    expect(lines(cartOf(await service.getCart(user, "loc_lisbon")))).toEqual([
      ["prd_smartdesk", 1],
    ]);
  });
});

describe("mergeCart", () => {
  it("hands a guest's cart to the visitor who signed in", async () => {
    const { service } = setup();

    await service.addItem(guest, "loc_bali", "prd_chair", 2);
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.mergeCart(guest.token, "user_01", "loc_bali"),
    );

    expect(lines(cart)).toEqual([["prd_chair", 2]]);
    expect(cartOf(await service.getCart(guest, "loc_bali")).items).toEqual([]);
  });

  it("adds to the cart the visitor already has", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    await service.addItem(guest, "loc_bali", "prd_chair", 2);
    await service.addItem(guest, "loc_bali", "prd_lamp");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.mergeCart(guest.token, "user_01", "loc_bali"),
    );

    expect(lines(cart)).toEqual([
      ["prd_lamp", 1],
      ["prd_chair", 3],
    ]);
  });

  it("never holds more units than the city has left", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_smartdesk", 2);
    await service.addItem(guest, "loc_bali", "prd_smartdesk", 3);
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.mergeCart(guest.token, "user_01", "loc_bali"),
    );

    expect(lines(cart)).toEqual([["prd_smartdesk", 3]]);
  });

  it("leaves the guest's other cities alone", async () => {
    const { service } = setup();

    await service.addItem(guest, "loc_lisbon", "prd_smartdesk");
    await service.mergeCart(guest.token, "user_01", "loc_bali");

    expect(lines(cartOf(await service.getCart(guest, "loc_lisbon")))).toEqual([
      ["prd_smartdesk", 1],
    ]);
  });

  it("returns the visitor's cart when the guest has none", async () => {
    const { service } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    const cart = await after(
      service,
      user,
      "loc_bali",
      service.mergeCart(guest.token, "user_01", "loc_bali"),
    );

    expect(lines(cart)).toEqual([["prd_chair", 1]]);
  });

  it("merges in one read and one write, however many lines the guest holds", async () => {
    const context = setup();

    for (let index = 0; index < 10; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });
      await context.service.addItem(guest, "loc_bali", `prd_filler_${index}`);
    }

    const before = context.roundTrips();
    await context.service.mergeCart(guest.token, "user_01", "loc_bali");

    expect(context.roundTrips() - before).toBe(2);
  });
});

describe("a cart that outlives a catalog edit", () => {
  it("keeps a line the city no longer offers, but stops pricing it", async () => {
    const { service, sqlite } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    sqlite.exec("DELETE FROM product_prices WHERE product_id = 'prd_chair'");

    const cart = cartOf(await service.getCart(user, "loc_bali"));

    expect(cart.items).toMatchObject([
      { productId: "prd_chair", weeklyPrice: 0, available: false },
    ]);
    expect(cart.summary.weeklySubtotal).toBe(0);
    expect(cart.summary.totalDueToday).toBe(0);
  });

  it("marks a line whose product was archived as unavailable", async () => {
    const { service, sqlite } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_chair'");

    const cart = cartOf(await service.getCart(user, "loc_bali"));

    expect(cart.items).toMatchObject([{ available: false }]);
    expect(cart.summary.totalDueToday).toBe(0);
  });

  it("lets the visitor remove such a line", async () => {
    const { service, sqlite } = setup();

    await service.addItem(user, "loc_bali", "prd_chair");
    sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_chair'");

    const cart = await after(
      service,
      user,
      "loc_bali",
      service.removeItem(user, "loc_bali", "prd_chair"),
    );

    expect(cart.items).toEqual([]);
  });
});
