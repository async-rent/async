import { expect, test } from "vite-plus/test";
import {
  cartSchema,
  getCatalogItem,
  paymentSchema,
  productQuerySchema,
  productSchema,
  quoteCart,
  rentalSchema,
  searchCatalog,
} from "../src/index";

test("the seeded catalog is valid and priced per location", () => {
  const bali = getCatalogItem("smartdesk-pro", "bali");
  const lisbon = getCatalogItem("smartdesk-pro", "lisbon");

  expect(bali?.price.weeklyPrice.amount).toBe(2900);
  expect(lisbon?.price.weeklyPrice.amount).toBe(3900);
  expect(bali?.product.name).toBe("SmartDesk Pro");
});

test("catalog search filters by city, category and query", () => {
  const desks = searchCatalog({ locationSlug: "bali", categorySlug: "desks" });
  expect(desks.items.length).toBeGreaterThan(0);
  expect(desks.items.every((item) => item.product.category.slug === "desks")).toBe(true);

  const search = searchCatalog({ locationSlug: "bali", q: "keyboard" });
  expect(search.items.some((item) => item.product.slug === "mechanical-keyboard")).toBe(true);

  const query = productQuerySchema.parse({ locationSlug: "bali" });
  expect(query.sort).toBe("featured");
  expect(query.pageSize).toBe(12);
});

test("a cart quotes the first week plus deposit per city", () => {
  const cart = quoteCart("bali", [{ productId: "prd_smartdesk", quantity: 1 }]);

  expect(cart.summary.weeklySubtotal).toBe(2900);
  expect(cart.summary.deposit).toBe(2900);
  expect(cart.summary.totalDueToday).toBe(5800);
  expect(cart.summary.recurringWeekly).toBe(2900);
  expect(cart.items[0]?.weeklyPrice.amount).toBe(2900);

  const lisbonCart = quoteCart("lisbon", [{ productId: "prd_smartdesk", quantity: 2 }]);
  expect(lisbonCart.summary.weeklySubtotal).toBe(7800);
  expect(lisbonCart.summary.deposit).toBe(7800);
  expect(lisbonCart.summary.totalDueToday).toBe(15600);
});

test("cart validation rejects empty and unavailable lines", () => {
  expect(() => quoteCart("bali", [])).toThrow();
  expect(() => quoteCart("da-nang", [{ productId: "prd_microphone", quantity: 1 }])).toThrow();
  expect(() => quoteCart("bali", [{ productId: "prd_smartdesk", quantity: 0 }])).toThrow();
});

test("the rental and PayPal payment flow parses", () => {
  const cart = quoteCart("bali", [{ productId: "prd_smartdesk", quantity: 1 }]);

  const parsedCart = cartSchema.parse(cart);
  expect(parsedCart.items).toHaveLength(1);

  const rental = rentalSchema.parse({
    id: "rnt_01",
    number: "AS-1042",
    contact: {
      name: "Luca",
      email: "luca@hey.com",
      whatsapp: "+62 812 3456 7890",
    },
    address: {
      line1: "Jl. Pantai Batu Bolong 60",
      area: "Canggu",
      city: "Canggu",
      postcode: "80351",
      countryCode: "ID",
    },
    locationSlug: "bali",
    items: cart.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      quantity: item.quantity,
      weeklyPrice: item.weeklyPrice,
      deposit: item.deposit,
    })),
    startDate: "2026-10-24",
    deliveryDate: "2026-10-24",
    deliveryWindow: { start: "10:00", end: "12:00" },
    status: "confirmed",
    fulfillmentStatus: "scheduled",
    summary: cart.summary,
    paymentStatus: "captured",
  });

  const payment = paymentSchema.parse({
    id: "pay_01",
    rentalId: rental.id,
    provider: "paypal",
    orderId: "ORDER-01",
    captureId: "CAPTURE-01",
    amount: { amount: 5800, currency: "USD" },
    status: "captured",
    paidAt: "2026-10-23T09:31:00Z",
  });

  expect(rental.summary.totalDueToday).toBe(5800);
  expect(payment.provider).toBe("paypal");
});

test("invalid product data is rejected", () => {
  expect(() =>
    productSchema.parse({
      id: "prd_bad",
      slug: "bad",
      name: "Bad",
      tagline: "Bad",
      description: "Bad",
      category: { id: "cat", slug: "cat", name: "Cat" },
      images: [{ url: "https://example.com/bad.jpg" }],
      prices: [],
    }),
  ).toThrow();
});
