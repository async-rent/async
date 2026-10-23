import { expect, test } from "vite-plus/test";
import { z } from "zod";
import {
  cartSchema,
  createResult,
  dateSchema,
  dateTimeSchema,
  isAvailableIn,
  paymentSchema,
  priceForLocation,
  productSchema,
  type FailedResult,
} from "../src/index";

const product = productSchema.parse({
  id: "prod_smartdesk_pro",
  slug: "smartdesk-pro",
  name: "SmartDesk Pro",
  tagline: "A standing desk that follows you between cities.",
  description: "Electric height adjustment and a generous work surface.",
  category: { id: "cat_desks", slug: "desks", name: "Desks" },
  images: [{ url: "https://cdn.async.rent/smartdesk-pro.jpg", alt: "SmartDesk Pro" }],
  prices: [
    { locationSlug: "bali", currency: "USD", weeklyPrice: 12000, stock: 3 },
    { locationSlug: "lisbon", currency: "USD", weeklyPrice: 15000, stock: 0 },
    { locationSlug: "da-nang", currency: "USD", weeklyPrice: 11000 },
  ],
  createdAt: "2026-10-24T09:30:00Z",
});

test("createResult returns the void success shape", () => {
  const result = createResult(z.void(), z.enum(["not_found", "conflict"]));

  expect(result.success()).toEqual({ success: true });
});

test("createResult returns a failure with the code and message as data", () => {
  const result = createResult(z.void(), z.enum(["not_found", "conflict"]));

  expect(result.failed("not_found", "Rental not found")).toEqual({
    success: false,
    error: { code: "not_found", message: "Rental not found" },
  });
});

test("createResult carries data on the success branch", () => {
  const result = createResult(z.object({ id: z.string() }), z.enum(["invalid"]));

  expect(result.success({ id: "rental_1" })).toEqual({
    success: true,
    data: { id: "rental_1" },
  });
});

test("failed() never throws, even for a code outside the enum", () => {
  const result = createResult(z.void(), z.enum(["not_found"]));
  const untyped = result.failed as (code: string, message: string) => FailedResult<string>;

  expect(() => untyped("off_enum", "Still plain data")).not.toThrow();
  expect(untyped("off_enum", "Still plain data")).toEqual({
    success: false,
    error: { code: "off_enum", message: "Still plain data" },
  });
});

test("priceForLocation resolves a listed city and misses an unlisted one", () => {
  expect(priceForLocation(product, "bali")?.weeklyPrice).toBe(12000);
  expect(priceForLocation(product, "chiang-mai")).toBeUndefined();
});

test("a product cannot list the same city twice", () => {
  const result = productSchema.safeParse({
    ...product,
    prices: [
      { locationSlug: "bali", currency: "USD", weeklyPrice: 12000 },
      { locationSlug: "bali", currency: "USD", weeklyPrice: 13000 },
    ],
  });

  expect(result.success).toBe(false);
});

test("isAvailableIn respects status, stock and missing cities", () => {
  expect(isAvailableIn(product, "bali")).toBe(true);
  expect(isAvailableIn(product, "da-nang")).toBe(true);
  expect(isAvailableIn(product, "lisbon")).toBe(false);
  expect(isAvailableIn(product, "chiang-mai")).toBe(false);
  expect(isAvailableIn({ ...product, status: "archived" }, "bali")).toBe(false);
});

test("a cart is single-currency: line prices are bare minor units", () => {
  const cart = cartSchema.parse({
    id: "cart_1",
    locationSlug: "bali",
    items: [
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        weeklyPrice: 12000,
      },
    ],
    summary: {
      currency: "USD",
      weeklySubtotal: 12000,
      totalDueToday: 12000,
      recurringWeekly: 12000,
    },
  });

  expect(cart.items[0]?.weeklyPrice).toBe(12000);
});

test("a payment represents one cycle of a recurring agreement", () => {
  const payment = paymentSchema.parse({
    id: "pay_1",
    rentalId: "rental_1",
    billingAgreementId: "bagr_1",
    provider: "paypal",
    billingCycle: 1,
    externalOrderId: "ORDER123",
    amount: 12000,
    currency: "USD",
    status: "succeeded",
    createdAt: "2026-10-24T09:30:00Z",
  });

  expect(payment.billingCycle).toBe(1);
  expect(payment.status).toBe("succeeded");
  expect(payment.billingAgreementId).toBe("bagr_1");
});

test("dateSchema rejects impossible calendar dates", () => {
  expect(dateSchema.safeParse("2026-10-24").success).toBe(true);
  expect(dateSchema.safeParse("2026-02-31").success).toBe(false);
});

test("dateTimeSchema accepts timezoned timestamps and rejects free text", () => {
  expect(dateTimeSchema.safeParse("2026-10-24T09:30:00Z").success).toBe(true);
  expect(dateTimeSchema.safeParse("2026-10-24T09:30:00+07:00").success).toBe(true);
  expect(dateTimeSchema.safeParse("not-a-date").success).toBe(false);
});
