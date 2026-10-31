import { describe, expect, it } from "vite-plus/test";
import { createTestDatabase, type TestDatabase } from "../../tests/database";
import type { CreateRentalInput, ListRentalsInput } from "./rental";
import type { Rental } from "../models";
import { createCartService } from "./cart";
import { createRentalService } from "./rental";

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
}

function setup() {
  const database = createTestDatabase();
  seedCatalog(database);

  return {
    ...database,
    cart: createCartService({ db: database.db }),
    service: createRentalService({ db: database.db }),
  };
}

const userId = "user_01";

const checkoutDetails = {
  contact: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    whatsapp: "+6281234567890",
  },
  address: {
    line1: "12 Jalan Pantai",
    area: "Canggu",
    city: "Bali",
    countryCode: "ID",
    deliveryNotes: "Ring the bell at the side gate.",
  },
  startDate: "2026-02-01",
} satisfies Omit<CreateRentalInput, "cartId">;

function rentalOf(result: {
  success: boolean;
  data?: Rental;
  error?: { message: string };
}): Rental {
  if (!result.success || !result.data) throw new Error(result.error?.message);

  return result.data;
}

type Context = ReturnType<typeof setup>;

// Apps parse `listRentalsInputSchema`, which fills page/pageSize; the service
// takes the parsed input, so the tests supply the same defaults here.
function listQuery(overrides: Partial<ListRentalsInput> = {}): ListRentalsInput {
  return { page: 1, pageSize: 20, ...overrides };
}

async function fillCart(
  context: Context,
  locationId: string,
  lines: Array<{ productId: string; quantity: number }>,
): Promise<string> {
  const opened = await context.cart.getCartByUserAndLocation({ userId, locationId });
  if (!opened.success) throw new Error("could not open the cart");

  const cartId = opened.data.id;
  for (const line of lines) {
    const put = await context.cart.putItem({ cartId, ...line });
    if (!put.success) throw new Error(`could not add ${line.productId}`);
  }

  return cartId;
}

async function placeRental(context: Context): Promise<Rental> {
  const cartId = await fillCart(context, "loc_bali", [
    { productId: "prd_smartdesk", quantity: 1 },
    { productId: "prd_chair", quantity: 2 },
  ]);

  return rentalOf(await context.service.createRental({ cartId, ...checkoutDetails }));
}

describe("createRental", () => {
  it("freezes the cart into a pending rental", async () => {
    const context = setup();
    const rental = await placeRental(context);

    expect(rental).toMatchObject({
      id: expect.any(String),
      number: expect.stringMatching(/^AR-2026-[A-Z2-9]{6}$/),
      contact: checkoutDetails.contact,
      address: checkoutDetails.address,
      locationId: "loc_bali",
      currency: "USD",
      startDate: "2026-02-01",
      status: "pending_payment",
    });

    // Lines are frozen in display order with their snapshotted prices.
    expect(rental.items).toEqual([
      {
        productId: "prd_chair",
        name: "Ergonomic Task Chair",
        slug: "ergonomic-task-chair",
        image: { url: "https://cdn.async.rent/prd_chair-0.jpg", alt: "Ergonomic Task Chair" },
        quantity: 2,
        weeklyPrice: 6000,
        deposit: 12000,
      },
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

    expect(rental.summary).toEqual({
      currency: "USD",
      weeklySubtotal: 24000,
      deposit: 48000,
      deliveryFee: 1000,
      discount: 0,
      totalDueToday: 73000,
    });
  });

  it("records the delivery day, window and accepted terms when given", async () => {
    const context = setup();
    const cartId = await fillCart(context, "loc_bali", [{ productId: "prd_chair", quantity: 1 }]);

    const rental = rentalOf(
      await context.service.createRental({
        cartId,
        ...checkoutDetails,
        endDate: "2026-03-01",
        deliveryDate: "2026-01-31",
        deliveryWindow: { start: "09:00", end: "12:00" },
        termsAcceptedAt: "2026-01-30T10:00:00.000Z",
      }),
    );

    expect(rental.endDate).toBe("2026-03-01");
    expect(rental.deliveryDate).toBe("2026-01-31");
    expect(rental.deliveryWindow).toEqual({ start: "09:00", end: "12:00" });
    expect(rental.termsAcceptedAt).toBe("2026-01-30T10:00:00.000Z");
  });

  it("holds its prices when the catalog changes afterwards", async () => {
    const context = setup();
    const rental = await placeRental(context);

    context.sqlite.exec(
      "UPDATE product_prices SET weekly_price = 99000 WHERE product_id = 'prd_chair'",
    );
    context.sqlite.exec("UPDATE products SET status = 'archived' WHERE id = 'prd_smartdesk'");

    const read = rentalOf(await context.service.getRentalById({ rentalId: rental.id }));

    expect(read.items.map((item) => [item.productId, item.weeklyPrice])).toEqual([
      ["prd_chair", 6000],
      ["prd_smartdesk", 12000],
    ]);
    expect(read.summary.weeklySubtotal).toBe(24000);
  });

  it("leaves out an unavailable line and prices only what remains", async () => {
    const context = setup();
    const cartId = await fillCart(context, "loc_bali", [
      { productId: "prd_smartdesk", quantity: 1 },
      { productId: "prd_chair", quantity: 1 },
    ]);
    // The chair leaves the Bali catalog after it was added to the cart.
    context.sqlite.exec("DELETE FROM product_prices WHERE product_id = 'prd_chair'");

    const rental = rentalOf(await context.service.createRental({ cartId, ...checkoutDetails }));

    expect(rental.items.map((item) => item.productId)).toEqual(["prd_smartdesk"]);
    expect(rental.summary.weeklySubtotal).toBe(12000);
  });

  it("gives every rental its own number", async () => {
    const context = setup();
    const first = await placeRental(context);
    const second = rentalOf(
      await context.service.createRental({
        cartId: await fillCart(context, "loc_lisbon", [
          { productId: "prd_smartdesk", quantity: 1 },
        ]),
        ...checkoutDetails,
      }),
    );

    expect(first.number).not.toBe(second.number);
  });

  it("refuses an empty cart", async () => {
    const context = setup();
    const cartId = await fillCart(context, "loc_bali", []);

    await expect(
      context.service.createRental({ cartId, ...checkoutDetails }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "cart_is_empty" },
    });
  });

  it("refuses a cart whose only items the city no longer rents", async () => {
    const context = setup();
    const cartId = await fillCart(context, "loc_bali", [{ productId: "prd_chair", quantity: 1 }]);
    context.sqlite.exec("DELETE FROM product_prices WHERE product_id = 'prd_chair'");

    await expect(
      context.service.createRental({ cartId, ...checkoutDetails }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "cart_is_empty" },
    });
  });

  it("refuses a cart that does not exist", async () => {
    const context = setup();

    await expect(
      context.service.createRental({ cartId: "cart_missing", ...checkoutDetails }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "cart_not_found" },
    });
  });

  it("refuses a city that is not open yet", async () => {
    const context = setup();
    const opened = await context.cart.getCartByUserAndLocation({
      userId,
      locationId: "loc_ko_tao",
    });
    if (!opened.success) throw new Error("could not open the cart");

    await expect(
      context.service.createRental({ cartId: opened.data.id, ...checkoutDetails }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "location_not_available" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const context = setup();
    const cartId = await fillCart(context, "loc_bali", [{ productId: "prd_chair", quantity: 1 }]);
    context.sqlite.close();

    await expect(
      context.service.createRental({ cartId, ...checkoutDetails }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_cart" },
    });
  });
});

describe("getRentalById", () => {
  it("reads the rental it names", async () => {
    const context = setup();
    const placed = await placeRental(context);

    const read = rentalOf(await context.service.getRentalById({ rentalId: placed.id }));

    expect(read.id).toBe(placed.id);
    expect(read.number).toBe(placed.number);
    expect(read.items.map((item) => item.productId)).toEqual(["prd_chair", "prd_smartdesk"]);
  });

  it("fails when the rental does not exist", async () => {
    const context = setup();

    await expect(context.service.getRentalById({ rentalId: "rnt_missing" })).resolves.toEqual({
      success: false,
      error: { code: "rental_not_found", message: "Rental rnt_missing not found" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const context = setup();
    context.sqlite.close();

    await expect(context.service.getRentalById({ rentalId: "rnt_any" })).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_rental" },
    });
  });
});

describe("getRentalByNumber", () => {
  it("reads the rental by its human-readable number", async () => {
    const context = setup();
    const placed = await placeRental(context);

    const read = rentalOf(await context.service.getRentalByNumber({ number: placed.number }));

    expect(read.id).toBe(placed.id);
  });

  it("fails when no rental has that number", async () => {
    const context = setup();

    await expect(
      context.service.getRentalByNumber({ number: "AR-2026-ZZZZZZ" }),
    ).resolves.toMatchObject({
      success: false,
      error: { code: "rental_not_found" },
    });
  });
});

describe("listRentals", () => {
  it("lists newest first and paginates", async () => {
    const context = setup();

    const numbers: string[] = [];
    for (let index = 0; index < 3; index++) {
      const cartId = await fillCart(context, "loc_bali", [{ productId: "prd_chair", quantity: 1 }]);
      const placed = rentalOf(await context.service.createRental({ cartId, ...checkoutDetails }));
      numbers.push(placed.number);
      // Keep the created_at order deterministic across rows.
      context.sqlite.exec(
        `UPDATE rentals SET created_at = ${createdAt + index * 1000} WHERE id = '${placed.id}'`,
      );
      await context.cart.clearCart({ cartId });
    }

    const firstPage = context.service.listRentals(listQuery({ page: 1, pageSize: 2 }));
    await expect(firstPage).resolves.toMatchObject({
      success: true,
      data: { total: 3, hasMore: true },
    });

    const page = await firstPage;
    if (!page.success) throw new Error("list failed");
    expect(page.data.items).toHaveLength(2);
    // Newest first: the last number placed comes first.
    expect(page.data.items[0]?.number).toBe(numbers[2]);

    const secondPage = await context.service.listRentals(listQuery({ page: 2, pageSize: 2 }));
    if (!secondPage.success) throw new Error("list failed");
    expect(secondPage.data.items).toHaveLength(1);
    expect(secondPage.data.hasMore).toBe(false);
  });

  it("filters by status", async () => {
    const context = setup();
    const placed = await placeRental(context);
    await context.service.cancelRental({ rentalId: placed.id });

    const cancelled = await context.service.listRentals(listQuery({ status: "cancelled" }));
    if (!cancelled.success) throw new Error("list failed");
    expect(cancelled.data.items.map((item) => item.id)).toEqual([placed.id]);

    const pending = await context.service.listRentals(listQuery({ status: "pending_payment" }));
    if (!pending.success) throw new Error("list failed");
    expect(pending.data.items).toEqual([]);
  });

  it("filters by user", async () => {
    const context = setup();
    const placed = await placeRental(context);
    // The rental is placed without a user, so a user filter excludes it.
    context.sqlite.exec(`UPDATE rentals SET user_id = 'user_01' WHERE id = '${placed.id}'`);

    const mine = await context.service.listRentals(listQuery({ userId: "user_01" }));
    if (!mine.success) throw new Error("list failed");
    expect(mine.data.items.map((item) => item.id)).toEqual([placed.id]);

    const theirs = await context.service.listRentals(listQuery({ userId: "user_99" }));
    if (!theirs.success) throw new Error("list failed");
    expect(theirs.data.items).toEqual([]);
  });

  it("reports a failure instead of throwing", async () => {
    const context = setup();
    context.sqlite.close();

    await expect(context.service.listRentals(listQuery())).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_list_rentals" },
    });
  });
});

describe("cancelRental", () => {
  it("cancels a pending rental", async () => {
    const context = setup();
    const placed = await placeRental(context);

    const cancelled = rentalOf(
      await context.service.cancelRental({ rentalId: placed.id, reason: "Changed plans" }),
    );

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toEqual(expect.any(String));
    expect(cancelled.notes).toBe("Changed plans");

    const read = rentalOf(await context.service.getRentalById({ rentalId: placed.id }));
    expect(read.status).toBe("cancelled");
  });

  it("refuses to cancel a completed rental", async () => {
    const context = setup();
    const placed = await placeRental(context);
    context.sqlite.exec(`UPDATE rentals SET status = 'completed' WHERE id = '${placed.id}'`);

    await expect(context.service.cancelRental({ rentalId: placed.id })).resolves.toMatchObject({
      success: false,
      error: { code: "rental_not_cancellable" },
    });
  });

  it("refuses to cancel a rental that is already cancelled", async () => {
    const context = setup();
    const placed = await placeRental(context);
    await context.service.cancelRental({ rentalId: placed.id });

    await expect(context.service.cancelRental({ rentalId: placed.id })).resolves.toMatchObject({
      success: false,
      error: { code: "rental_not_cancellable" },
    });
  });

  it("fails when the rental does not exist", async () => {
    const context = setup();

    await expect(context.service.cancelRental({ rentalId: "rnt_missing" })).resolves.toMatchObject({
      success: false,
      error: { code: "rental_not_found" },
    });
  });

  it("reports a failure instead of throwing", async () => {
    const context = setup();
    context.sqlite.close();

    await expect(context.service.cancelRental({ rentalId: "rnt_any" })).resolves.toMatchObject({
      success: false,
      error: { code: "failed_to_load_rental" },
    });
  });
});
