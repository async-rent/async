import { expect, test } from "vite-plus/test";
import { z } from "zod";
import {
  addressSchema,
  billingScheduleSchema,
  cartSchema,
  createProductSchema,
  customerSchema,
  deliverySchema,
  deliverySlotSchema,
  exchangeRateSchema,
  inventoryAvailabilitySchema,
  inventoryUnitSchema,
  locationSchema,
  maintenanceRecordSchema,
  notificationSchema,
  paymentSchema,
  productOfferingSchema,
  productPageSchema,
  productQuerySchema,
  productSchema,
  promotionRedemptionSchema,
  promotionSchema,
  rentalPolicySchema,
  rentalSchema,
  reservationSchema,
} from "../src/index";
import type { Product, ProductOf } from "../src/index";

const location = {
  id: "loc_bali",
  slug: "bali",
  name: "Bali",
  country: "Indonesia",
  countryCode: "ID",
  timezone: "Asia/Makassar",
  locale: "en-ID",
  currency: "IDR",
  status: "active",
  serviceAreas: [{ id: "area_canggu", name: "Canggu", city: "Canggu", postcodes: ["80351"] }],
  tax: { inclusive: true, rate: 0.11, label: "PB1" },
} as const;

const product = {
  id: "prd_smartdesk",
  slug: "smartdesk-pro",
  name: "SmartDesk Pro",
  status: "active",
  kind: "item",
  category: { id: "cat_desks", slug: "desks", name: "Desks" },
  media: { cover: { url: "https://cdn.async.rent/smartdesk-pro.jpg" } },
  pricing: { currency: "USD", weekly: 1200, deposit: 0, deliveryFee: 0 },
  highlights: ["Electric", "120 × 70 cm"],
} as const;

const customer = {
  id: "cus_luca",
  status: "active",
  contact: {
    name: "Luca",
    email: "luca@hey.com",
    whatsapp: "+62 812 3456 7890",
  },
  defaultLocationId: location.id,
} as const;

const address = {
  id: "adr_villa",
  customerId: customer.id,
  locationId: location.id,
  label: "Villa",
  line1: "Jl. Pantai Batu Bolong 60",
  area: "Canggu",
  city: "Canggu",
  postcode: "80351",
  countryCode: "ID",
} as const;

const addressSnapshot = {
  locationId: location.id,
  label: "Villa",
  recipientName: "Luca",
  phone: "+62 812 3456 7890",
  line1: "Jl. Pantai Batu Bolong 60",
  area: "Canggu",
  city: "Canggu",
  postcode: "80351",
  countryCode: "ID",
} as const;

const exchangeRate = {
  baseCurrency: "USD",
  quoteCurrency: "IDR",
  rate: 16250,
  asOf: "2026-10-23T08:00:00+08:00",
  source: "manual",
} as const;

const summary = {
  currency: "IDR",
  weeklySubtotal: 195000,
  deliveryFee: 0,
  deposit: 0,
  dueToday: 195000,
  recurringWeekly: 195000,
} as const;

test("product metadata stays typed and optional", () => {
  const deskMetadataSchema = z.object({
    widthCm: z.number(),
    depthCm: z.number(),
    electric: z.boolean(),
  });

  const deskProductSchema = createProductSchema(deskMetadataSchema);
  const desk = deskProductSchema.parse({
    ...product,
    metadata: { widthCm: 120, depthCm: 70, electric: true },
  });

  const typedDesk: Product<{ widthCm: number; depthCm: number; electric: boolean }> = desk;
  const inferredDesk: ProductOf<typeof deskProductSchema> = desk;

  expect(desk.metadata?.electric).toBe(true);
  expect(typedDesk.metadata?.widthCm).toBe(120);
  expect(inferredDesk.metadata?.electric).toBe(true);
  expect(productSchema.parse(product).name).toBe("SmartDesk Pro");
});

test("a location can set an explicit price instead of converting USD", () => {
  const offering = productOfferingSchema.parse({
    id: "off_smartdesk_bali",
    productId: product.id,
    locationId: location.id,
    status: "active",
    currency: "IDR",
    pricing: {
      currency: "IDR",
      weekly: 195000,
      deposit: 0,
      deliveryFee: 0,
      tax: { inclusive: true, rate: 0.11, label: "PB1" },
    },
    availability: { status: "available", units: 25, availableUnits: 6 },
  });

  expect(offering.pricing?.weekly).toBe(195000);
  expect(exchangeRateSchema.parse(exchangeRate).quoteCurrency).toBe("IDR");
});

test("the catalog query and paginated page parse", () => {
  const query = productQuerySchema.parse({
    q: "desks",
    locationId: location.id,
    currency: "IDR",
    sort: "most_rented",
    page: 1,
    pageSize: 12,
  });

  const page = productPageSchema.parse({
    items: [productSchema.parse(product)],
    total: 25,
    page: 1,
    pageSize: 12,
    hasMore: true,
  });

  expect(query.sort).toBe("most_rented");
  expect(page.items).toHaveLength(1);
  expect(page.hasMore).toBe(true);
});

test("the full cart, rental, payment, delivery and inventory flow parses", () => {
  locationSchema.parse(location);
  customerSchema.parse(customer);
  addressSchema.parse(address);

  const policy = rentalPolicySchema.parse({
    id: "pol_standard",
    name: "Standard weekly rental",
    version: "2026-10",
    minimumWeeks: 1,
    billingCycleWeeks: 1,
    cancelAnytime: true,
    swapAllowed: true,
    swapEligibleAfterWeeks: 1,
    depositRequired: false,
    deliveryIncluded: true,
    setupIncluded: true,
  });

  const cart = cartSchema.parse({
    id: "cart_01",
    customerId: customer.id,
    status: "active",
    locationId: location.id,
    currency: "IDR",
    rentalWeeks: 1,
    deliveryDate: "2026-10-24",
    addressId: address.id,
    items: [
      {
        id: "line_01",
        productId: product.id,
        productOfferingId: "off_smartdesk_bali",
        name: product.name,
        kind: "item",
        quantity: 1,
        weeklyPrice: { amount: 195000, currency: "IDR" },
      },
    ],
    summary,
    exchangeRate,
  });

  const rental = rentalSchema.parse({
    id: "rnt_01",
    number: "AS-1042",
    customerId: customer.id,
    contact: customer.contact,
    locationId: location.id,
    address: addressSnapshot,
    deliveryDate: "2026-10-24",
    deliveryWindow: { startTime: "10:00", endTime: "12:00" },
    rentalWeeks: 1,
    startDate: "2026-10-24",
    status: "confirmed",
    items: [
      {
        id: "ritem_01",
        rentalId: "rnt_01",
        productId: product.id,
        productOfferingId: "off_smartdesk_bali",
        name: product.name,
        kind: "item",
        quantity: 1,
        rentalWeeks: 1,
        weeklyPrice: { amount: 195000, currency: "IDR" },
        status: "reserved",
      },
    ],
    currency: "IDR",
    summary,
    rentalPolicy: { id: policy.id, name: policy.name, version: policy.version },
    paymentStatus: "succeeded",
    fulfillmentStatus: "scheduled",
    termsVersion: policy.version,
    termsAcceptedAt: "2026-10-23T09:30:00+08:00",
  });

  paymentSchema.parse({
    id: "pay_01",
    rentalId: rental.id,
    customerId: customer.id,
    kind: "first_week",
    provider: "paypal",
    providerPaymentId: "CAPTURE-01",
    amount: { amount: 195000, currency: "IDR" },
    status: "succeeded",
    paidAt: "2026-10-23T09:31:00+08:00",
  });

  billingScheduleSchema.parse({
    id: "bill_01",
    rentalId: rental.id,
    cycleWeeks: 1,
    amount: { amount: 195000, currency: "IDR" },
    nextChargeAt: "2026-10-31T00:00:00+08:00",
    status: "active",
    provider: "paypal",
  });

  const slot = deliverySlotSchema.parse({
    id: "slot_01",
    locationId: location.id,
    date: "2026-10-24",
    window: { startTime: "10:00", endTime: "12:00" },
    capacity: 8,
    bookedCount: 3,
    status: "open",
  });

  deliverySchema.parse({
    id: "dlv_01",
    rentalId: rental.id,
    type: "delivery",
    status: "scheduled",
    slotId: slot.id,
    scheduledDate: slot.date,
    window: slot.window,
    address: addressSnapshot,
    contact: customer.contact,
    assignee: { name: "Wayan", phone: "+62 812 0000 0000" },
  });

  const unit = inventoryUnitSchema.parse({
    id: "unit_01",
    serialNumber: "SD-0001",
    productId: product.id,
    locationId: location.id,
    status: "reserved",
    condition: "excellent",
    currentRentalId: rental.id,
    currentRentalItemId: "ritem_01",
  });

  reservationSchema.parse({
    id: "res_01",
    inventoryUnitId: unit.id,
    productId: product.id,
    locationId: location.id,
    rentalId: rental.id,
    rentalItemId: "ritem_01",
    period: { start: "2026-10-24", end: "2026-10-31" },
    status: "confirmed",
  });

  maintenanceRecordSchema.parse({
    id: "mnt_01",
    inventoryUnitId: unit.id,
    reason: "routine",
    status: "scheduled",
    scheduledFor: "2026-11-02T09:00:00+08:00",
  });

  inventoryAvailabilitySchema.parse({
    productId: product.id,
    locationId: location.id,
    period: { start: "2026-10-24", end: "2026-10-31" },
    totalUnits: 25,
    availableUnits: 6,
    reservedUnits: 19,
  });

  const promotion = promotionSchema.parse({
    id: "promo_free_setup",
    name: "Autumn free setup",
    headline: "Free setup",
    type: "free_setup",
    autoApply: true,
    appliesTo: { locationIds: [location.id] },
    status: "active",
  });

  promotionRedemptionSchema.parse({
    id: "red_01",
    promotionId: promotion.id,
    customerId: customer.id,
    rentalId: rental.id,
    discountAmount: { amount: 0, currency: "IDR" },
    status: "applied",
  });

  notificationSchema.parse({
    id: "ntf_01",
    customerId: customer.id,
    rentalId: rental.id,
    deliveryId: "dlv_01",
    channel: "whatsapp",
    template: "arriving_soon",
    recipient: customer.contact.whatsapp,
    status: "queued",
  });

  expect(cart.items).toHaveLength(1);
  expect(rental.items[0]?.status).toBe("reserved");
  expect(policy.version).toBe(rental.termsVersion);
});
