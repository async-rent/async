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

/** A signed-in visitor. */
const user: CartOwner = { kind: "user", userId: "user_01" };

/** A guest, holding the session token their browser carries. */
const guest: CartOwner = {
  kind: "guest",
  sessionToken: "a-session-token-long-enough-to-be-real",
};

/** The Bali cart of a signed-in visitor, created on the first visit. */
async function baliCart(service: ReturnType<typeof createCartService>): Promise<Cart> {
  const result = await service.getCartByOwner(user, "loc_bali");
  if (!result.success) throw new Error(result.error.message);

  return result.data;
}

/** Reads a cart back, for the assertions that follow a change. */
async function readCart(
  service: ReturnType<typeof createCartService>,
  cartId: string,
): Promise<Cart> {
  const result = await service.getCartById(cartId);
  if (!result.success) throw new Error(result.error.message);

  return result.data;
}

describe("getCartByOwner", () => {
  it("creates an empty cart on the first visit", async () => {
    const { service } = setup();

    const result = await service.getCartByOwner(user, "loc_bali");
    if (!result.success) throw new Error(result.error.message);

    expect(result.data).toMatchObject({
      locationId: "loc_bali",
      currency: "USD",
      weeks: 1,
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
    expect(result.data.id).toBeTruthy();
  });

  it("gives the same visitor the same cart in the same city", async () => {
    const { service } = setup();

    const first = await baliCart(service);
    const second = await baliCart(service);

    expect(second.id).toBe(first.id);
  });

  it("gives a visitor one cart per city", async () => {
    const { service } = setup();

    const bali = await baliCart(service);
    const lisbon = await service.getCartByOwner(user, "loc_lisbon");
    if (!lisbon.success) throw new Error(lisbon.error.message);

    expect(lisbon.data.id).not.toBe(bali.id);
    expect(lisbon.data.locationId).toBe("loc_lisbon");
  });

  it("keeps a guest's cart apart from a signed-in visitor's", async () => {
    const { service } = setup();

    const asGuest = await service.getCartByOwner(guest, "loc_bali");
    if (!asGuest.success) throw new Error(asGuest.error.message);

    const asUser = await baliCart(service);

    expect(asGuest.data.id).not.toBe(asUser.id);
  });

  it("never stores the session token itself", async () => {
    const { service, sqlite } = setup();

    const result = await service.getCartByOwner(guest, "loc_bali");
    if (!result.success) throw new Error(result.error.message);

    const row = sqlite
      .prepare("SELECT owner_type, owner_id FROM carts WHERE id = ?")
      .get(result.data.id) as { owner_type: string; owner_id: string };

    expect(row.owner_type).toBe("guest");
    expect(row.owner_id).not.toContain("session-token");
    expect(row.owner_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails when the city does not exist", async () => {
    const { service } = setup();

    await expect(service.getCartByOwner(user, "loc_nowhere")).resolves.toEqual({
      success: false,
      error: { code: "location_not_found", message: "Location loc_nowhere not found" },
    });
  });

  it("fails when the city is not open yet", async () => {
    const { service } = setup();

    await expect(service.getCartByOwner(user, "loc_ko_tao")).resolves.toEqual({
      success: false,
      error: {
        code: "location_not_available",
        message: "Location loc_ko_tao is not open yet",
      },
    });
  });

  it("reports a lookup failure instead of throwing", async () => {
    const { service, sqlite } = setup();
    sqlite.close();

    await expect(service.getCartByOwner(user, "loc_bali")).resolves.toEqual({
      success: false,
      error: { code: "failed_to_load_cart", message: "Failed to load cart" },
    });
  });
});

describe("getCartById", () => {
  it("returns one cart by its id", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    const result = await service.getCartById(cart.id);

    expect(result).toEqual({ success: true, data: cart });
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(service.getCartById("cart_missing")).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });
});

describe("addItem", () => {
  it("puts a product in the cart and prices it from the city", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    const result = await service.addItem(cart.id, "prd_smartdesk");

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.items).toEqual([
      {
        productId: "prd_smartdesk",
        name: "SmartDesk Pro",
        slug: "smartdesk-pro",
        image: { url: "https://cdn.async.rent/prd_smartdesk-0.jpg", alt: "SmartDesk Pro" },
        quantity: 1,
        weeklyPrice: 12000,
        deposit: 24000,
        available: true,
      },
    ]);

    // 12000 a week, 24000 deposit, and Bali's 1000 delivery, once.
    expect(updated.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 12000,
      deposit: 24000,
      deliveryFee: 1000,
      discount: 0,
      totalDueToday: 37000,
    });
  });

  it("adds to a line that is already in the cart", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair", 2);
    await service.addItem(cart.id, "prd_chair");

    const updated = await readCart(service, cart.id);

    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].quantity).toBe(3);
    expect(updated.summary.weeklySubtotal).toBe(18000);
    expect(updated.summary.deposit).toBe(36000);
  });

  it("charges delivery once for the order, not per line", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_smartdesk");
    await service.addItem(cart.id, "prd_chair");

    const updated = await readCart(service, cart.id);

    expect(updated.summary.deliveryFee).toBe(1000);
  });

  it("keeps one line per product", async () => {
    const { service, sqlite } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_smartdesk");
    await service.addItem(cart.id, "prd_smartdesk");

    const rows = sqlite
      .prepare("SELECT product_id, quantity FROM cart_items WHERE cart_id = ?")
      .all(cart.id);

    expect(rows).toEqual([{ product_id: "prd_smartdesk", quantity: 2 }]);
  });

  it("refuses a product that is not rented in the cart's city", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.addItem(cart.id, "prd_missing")).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_missing is not available in loc_bali",
      },
    });
  });

  it("refuses an archived product", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.addItem(cart.id, "prd_archived")).resolves.toEqual({
      success: false,
      error: {
        code: "product_not_available",
        message: "Product prd_archived is not available in loc_bali",
      },
    });
  });

  it("refuses more units than the city has left", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.addItem(cart.id, "prd_smartdesk", 4)).resolves.toEqual({
      success: false,
      error: {
        code: "product_out_of_stock",
        message: "Only 3 of prd_smartdesk available in loc_bali",
      },
    });

    await expect(service.addItem(cart.id, "prd_smartdesk", 3)).resolves.toEqual({
      success: true,
    });
  });

  it("counts the units already in the cart against the stock", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_smartdesk", 2);

    await expect(service.addItem(cart.id, "prd_smartdesk", 2)).resolves.toEqual({
      success: false,
      error: {
        code: "product_out_of_stock",
        message: "Only 3 of prd_smartdesk available in loc_bali",
      },
    });
  });

  it("refuses a quantity that is not a whole number of units", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.addItem(cart.id, "prd_chair", 0)).resolves.toEqual({
      success: false,
      error: {
        code: "invalid_quantity",
        message: "Quantity must be a whole number between 1 and 30",
      },
    });

    await expect(service.addItem(cart.id, "prd_chair", 1.5)).resolves.toEqual({
      success: false,
      error: {
        code: "invalid_quantity",
        message: "Quantity must be a whole number between 1 and 30",
      },
    });
  });

  it("fails when the cart does not exist", async () => {
    const { service } = setup();

    await expect(service.addItem("cart_missing", "prd_chair")).resolves.toEqual({
      success: false,
      error: { code: "cart_not_found", message: "Cart cart_missing not found" },
    });
  });

  it("reports a write failure instead of throwing", async () => {
    const { service, sqlite } = setup();

    const cart = await baliCart(service);
    sqlite.close();

    await expect(service.addItem(cart.id, "prd_chair")).resolves.toEqual({
      success: false,
      error: { code: "failed_to_load_cart", message: "Failed to load cart" },
    });
  });

  it("refuses a cart that already holds as many kinds of gear as it can", async () => {
    const context = setup();
    const { service, sqlite } = context;

    const cart = await baliCart(service);

    // Twenty-five kinds of gear, one short of the cap.
    for (let index = 0; index < 25; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });

      sqlite
        .prepare("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, 1)")
        .run(cart.id, `prd_filler_${index}`);
    }

    await expect(service.addItem(cart.id, "prd_chair")).resolves.toEqual({
      success: false,
      error: {
        code: "cart_is_full",
        message: "A cart holds at most 25 kinds of gear",
      },
    });

    // More of what is already in the cart is still fine.
    await expect(service.addItem(cart.id, "prd_filler_0", 2)).resolves.toEqual({
      success: true,
    });
  });
});

describe("setItemQuantity", () => {
  it("sets the number of units of a line", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair", 2);

    const result = await service.setItemQuantity(cart.id, "prd_chair", 5);

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.items[0].quantity).toBe(5);
    expect(updated.summary.weeklySubtotal).toBe(30000);
  });

  it("removes the line when the quantity is zero", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair");

    const result = await service.setItemQuantity(cart.id, "prd_chair", 0);

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.items).toEqual([]);
    expect(updated.summary.totalDueToday).toBe(0);
  });

  it("refuses more units than the city has left", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_smartdesk");

    await expect(service.setItemQuantity(cart.id, "prd_smartdesk", 9)).resolves.toEqual({
      success: false,
      error: {
        code: "product_out_of_stock",
        message: "Only 3 of prd_smartdesk available in loc_bali",
      },
    });
  });

  it("refuses a negative quantity", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.setItemQuantity(cart.id, "prd_chair", -1)).resolves.toEqual({
      success: false,
      error: {
        code: "invalid_quantity",
        message: "Quantity must be a whole number between 0 and 30",
      },
    });
  });
});

describe("removeItem", () => {
  it("takes a product out of the cart", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair");
    await service.addItem(cart.id, "prd_lamp");

    const result = await service.removeItem(cart.id, "prd_chair");

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.items.map((item) => item.productId)).toEqual(["prd_lamp"]);
  });

  it("fails when the product is not in the cart", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.removeItem(cart.id, "prd_chair")).resolves.toEqual({
      success: false,
      error: {
        code: "cart_item_not_found",
        message: "Product prd_chair is not in the cart",
      },
    });
  });
});

describe("setWeeks", () => {
  it("sets how long the rental runs", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    const result = await service.setWeeks(cart.id, 4);

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.weeks).toBe(4);
  });

  it("does not change what is due today, because the rent bills weekly", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_smartdesk");

    await service.setWeeks(cart.id, 4);

    const updated = await readCart(service, cart.id);

    expect(updated.summary.totalDueToday).toBe(37000);
  });

  it("refuses a length that is not a whole number of weeks", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.setWeeks(cart.id, 0)).resolves.toEqual({
      success: false,
      error: {
        code: "invalid_weeks",
        message: "Weeks must be a whole number between 1 and 24",
      },
    });

    await expect(service.setWeeks(cart.id, 53)).resolves.toEqual({
      success: false,
      error: {
        code: "invalid_weeks",
        message: "Weeks must be a whole number between 1 and 24",
      },
    });
  });
});

describe("clearCart", () => {
  it("empties the cart but keeps the cart itself", async () => {
    const { service } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair");

    const result = await service.clearCart(cart.id);

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, cart.id);

    expect(updated.id).toBe(cart.id);
    expect(updated.items).toEqual([]);
    expect(updated.summary.totalDueToday).toBe(0);
  });
});

describe("claimCart", () => {
  it("hands a guest's cart to the visitor who signed in", async () => {
    const { service } = setup();

    const guestCart = await service.getCartByOwner(guest, "loc_bali");
    if (!guestCart.success) throw new Error(guestCart.error.message);

    await service.addItem(guestCart.data.id, "prd_chair", 2);

    const result = await service.claimCart(guestCart.data.id, "user_01");

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, guestCart.data.id);

    expect(updated.items[0]).toMatchObject({ productId: "prd_chair", quantity: 2 });
  });

  it("merges into the cart the visitor already has in that city", async () => {
    const { service, sqlite } = setup();

    const own = await baliCart(service);
    await service.addItem(own.id, "prd_chair", 2);

    const guestCart = await service.getCartByOwner(guest, "loc_bali");
    if (!guestCart.success) throw new Error(guestCart.error.message);
    await service.addItem(guestCart.data.id, "prd_chair", 3);

    const result = await service.claimCart(guestCart.data.id, "user_01");

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, own.id);

    expect(updated.id).toBe(own.id);
    expect(updated.items[0].quantity).toBe(5);

    // The guest cart is gone once its contents live in the visitor's cart.
    const rows = sqlite.prepare("SELECT id FROM carts WHERE id = ?").all(guestCart.data.id);
    expect(rows).toEqual([]);
  });

  it("never holds more units than the city has left", async () => {
    const { service } = setup();

    const own = await baliCart(service);
    await service.addItem(own.id, "prd_smartdesk", 2);

    const guestCart = await service.getCartByOwner(guest, "loc_bali");
    if (!guestCart.success) throw new Error(guestCart.error.message);
    await service.addItem(guestCart.data.id, "prd_smartdesk", 2);

    await service.claimCart(guestCart.data.id, "user_01");

    const updated = await readCart(service, own.id);

    expect(updated.items[0].quantity).toBe(3);
  });

  it("refuses a cart that is not a guest's", async () => {
    const { service } = setup();

    const cart = await baliCart(service);

    await expect(service.claimCart(cart.id, "user_01")).resolves.toEqual({
      success: false,
      error: {
        code: "cart_not_claimable",
        message: `Cart ${cart.id} does not belong to a guest`,
      },
    });
  });

  it("claims an empty guest cart", async () => {
    const { service, sqlite } = setup();

    const guestCart = await service.getCartByOwner(guest, "loc_bali");
    if (!guestCart.success) throw new Error(guestCart.error.message);

    const result = await service.claimCart(guestCart.data.id, "user_01");

    expect(result).toEqual({ success: true });

    const rows = sqlite
      .prepare("SELECT owner_type, owner_id FROM carts WHERE id = ?")
      .all(guestCart.data.id);

    expect(rows).toEqual([{ owner_type: "user", owner_id: "user_01" }]);
  });

  it("claims a guest cart in the city the guest was shopping in", async () => {
    const { service } = setup();

    const guestCart = await service.getCartByOwner(guest, "loc_lisbon");
    if (!guestCart.success) throw new Error(guestCart.error.message);

    const result = await service.claimCart(guestCart.data.id, "user_01");

    expect(result).toEqual({ success: true });

    const updated = await readCart(service, guestCart.data.id);
    expect(updated.locationId).toBe("loc_lisbon");
  });
});

describe("how many statements the service sends", () => {
  it("reads a cart in one round trip, however many lines it holds", async () => {
    const context = setup();
    const { service, sqlite } = context;

    const cart = await baliCart(service);

    for (let index = 0; index < 10; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });

      sqlite
        .prepare("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, 1)")
        .run(cart.id, `prd_filler_${index}`);
    }

    const before = context.roundTrips();
    await readCart(service, cart.id);

    expect(context.roundTrips() - before).toBe(1);
  });

  it("checks and adds in two round trips: one to read, one to write", async () => {
    const context = setup();
    const { service } = context;

    const cart = await baliCart(service);

    const before = context.roundTrips();
    await service.addItem(cart.id, "prd_chair");

    // Everything the check needs is read in one batch. The write follows it,
    // because what it writes depends on what the check found.
    expect(context.roundTrips() - before).toBe(2);
  });

  it("merges a guest cart in one round trip, however many lines it holds", async () => {
    const context = setup();
    const { service, sqlite } = context;

    const own = await baliCart(service);
    await service.addItem(own.id, "prd_chair");

    const guestCart = await service.getCartByOwner(guest, "loc_bali");
    if (!guestCart.success) throw new Error(guestCart.error.message);

    for (let index = 0; index < 10; index++) {
      insertProduct(context, {
        id: `prd_filler_${index}`,
        name: `Filler ${index}`,
        prices: [{ locationId: "loc_bali", weeklyPrice: 1000 }],
      });

      sqlite
        .prepare("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, 1)")
        .run(guestCart.data.id, `prd_filler_${index}`);
    }

    const before = context.roundTrips();
    await service.claimCart(guestCart.data.id, "user_01");

    // One round trip to read both carts, one to move the lines.
    expect(context.roundTrips() - before).toBe(2);
  });
});

describe("a cart that outlives a catalog edit", () => {
  it("keeps a line the city no longer offers, but stops pricing it", async () => {
    const { service, sqlite } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair");

    // The city drops the chair.
    sqlite.exec("DELETE FROM product_prices WHERE product_id = 'prd_chair'");

    const updated = await readCart(service, cart.id);

    expect(updated.items).toEqual([
      {
        productId: "prd_chair",
        name: "Ergonomic Task Chair",
        slug: "ergonomic-task-chair",
        image: { url: "https://cdn.async.rent/prd_chair-0.jpg", alt: "Ergonomic Task Chair" },
        quantity: 1,
        weeklyPrice: 0,
        deposit: undefined,
        available: false,
      },
    ]);

    // An unpriceable line is not part of the totals.
    expect(updated.summary.weeklySubtotal).toBe(0);
    expect(updated.summary.totalDueToday).toBe(0);
  });

  it("marks a line whose product was archived as unavailable", async () => {
    const { service, sqlite } = setup();

    const cart = await baliCart(service);
    await service.addItem(cart.id, "prd_chair");

    sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_chair'");

    const updated = await readCart(service, cart.id);

    expect(updated.items[0].available).toBe(false);
    expect(updated.summary.weeklySubtotal).toBe(0);
  });
});
