import type {
  Address,
  BillingAgreement,
  Cart,
  CartItem,
  Category,
  ChargeSummary,
  Contact,
  Location,
  Payment,
  Product,
  ProductPrice,
  Rental,
  RentalItem,
} from "../src/types";
import type { Image } from "../src/utils";

/**
 * Shared builders for valid domain objects.
 *
 * Every builder returns a value that passes its schema, so tests only override
 * the fields they care about (`makeProduct({ status: "archived" })`) and never
 * repeat the required boilerplate.
 */

/** A fixed calendar date, so assertions never depend on the clock. */
export const isoDate = "2026-10-24";

/** A fixed UTC timestamp with a timezone, matching `dateTimeSchema`. */
export const isoDateTime = "2026-10-24T09:30:00Z";

export function makeImage(overrides: Partial<Image> = {}): Image {
  return {
    url: "https://cdn.async.rent/smartdesk-pro.jpg",
    alt: "SmartDesk Pro",
    ...overrides,
  };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "loc_bali",
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    timezone: "Asia/Makassar",
    currency: "USD",
    deliveryFee: 1000,
    status: "active",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat_desks",
    slug: "desks",
    name: "Desks",
    sortOrder: 0,
    ...overrides,
  };
}

export function makeProductPrice(overrides: Partial<ProductPrice> = {}): ProductPrice {
  return {
    locationId: makeLocation().id,
    weeklyPrice: 12000,
    ...overrides,
  };
}

export function makeProduct(overrides: Partial<Product> = {}): Product {
  const product: Product = {
    id: "prod_smartdesk-pro",
    slug: "smartdesk-pro",
    name: "SmartDesk Pro",
    tagline: "A height-adjustable desk for any workspace.",
    description: "A long-form description used on the product page.",
    categoryId: "cat_desks",
    images: [makeImage()],
    prices: [makeProductPrice()],
    highlights: [],
    specs: [],
    featured: false,
    status: "active",
    createdAt: isoDateTime,
    ...overrides,
  };

  return product;
}

export function makeChargeSummary(overrides: Partial<ChargeSummary> = {}): ChargeSummary {
  return {
    currency: "USD",
    weeklySubtotal: 12000,
    deposit: 0,
    deliveryFee: 0,
    discount: 0,
    totalDueToday: 12000,
    ...overrides,
  };
}

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod_smartdesk-pro",
    name: "SmartDesk Pro",
    slug: "smartdesk-pro",
    quantity: 1,
    weeklyPrice: 12000,
    available: true,
    ...overrides,
  };
}

export function makeCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart_01",
    locationId: makeLocation().id,
    currency: "USD",
    weeks: 1,
    items: [makeCartItem()],
    summary: makeChargeSummary(),
    ...overrides,
  };
}

export function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    ...overrides,
  };
}

export function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    line1: "Jl. Pantai Batu Bolong 60",
    city: "Canggu",
    countryCode: "ID",
    ...overrides,
  };
}

export function makeRentalItem(overrides: Partial<RentalItem> = {}): RentalItem {
  return {
    productId: "prod_smartdesk-pro",
    name: "SmartDesk Pro",
    slug: "smartdesk-pro",
    quantity: 1,
    weeklyPrice: 12000,
    ...overrides,
  };
}

export function makeRental(overrides: Partial<Rental> = {}): Rental {
  return {
    id: "rent_01",
    number: "AS-1042",
    contact: makeContact(),
    address: makeAddress(),
    locationId: makeLocation().id,
    currency: "USD",
    items: [makeRentalItem()],
    startDate: isoDate,
    status: "confirmed",
    summary: makeChargeSummary(),
    createdAt: isoDateTime,
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay_01",
    rentalId: "rent_01",
    billingCycle: 1,
    provider: "paypal",
    externalOrderId: "ORDER-1",
    amount: 12000,
    currency: "USD",
    status: "succeeded",
    createdAt: isoDateTime,
    ...overrides,
  };
}

export function makeBillingAgreement(overrides: Partial<BillingAgreement> = {}): BillingAgreement {
  return {
    id: "ba_01",
    rentalId: "rent_01",
    provider: "paypal",
    interval: "weekly",
    currency: "USD",
    status: "active",
    createdAt: isoDateTime,
    ...overrides,
  };
}
