import type { Location } from "@async-rent/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CustomerPayment } from "../../shared/payments";
import { errorCodeMetaKey } from "../../shared/tools";
import type { ConfirmPaymentOutput } from "../../tools/confirm-payment";
import type { ProductSummary, SearchProductsOutput } from "../../tools/search-products";
import type { StartPaymentOutput } from "../../tools/start-payment";

// Seed data, so the cards look like the dev environment's.
const storefrontUrl = "https://async-rent-storefront-dev.luckzivanius.workers.dev";

const photo = (file: string, alt: string) => ({ url: `${storefrontUrl}/products/${file}`, alt });

const bali = (weeklyPrice: number) => [{ locationId: "loc_bali", weeklyPrice }];

const everyCity = (weeklyPrice: number) => [
  { locationId: "loc_bali", weeklyPrice },
  { locationId: "loc_chiang_mai", weeklyPrice: Math.round((weeklyPrice * 0.9) / 50) * 50 },
  { locationId: "loc_lisbon", weeklyPrice: Math.round((weeklyPrice * 1.1) / 50) * 50 },
];

type Card = Omit<ProductSummary, "prices">;

const fullSetup: Card = {
  id: "prd_setup_full",
  slug: "setup-full",
  name: "The full setup",
  tagline: "The whole desk, delivered and assembled",
  categoryId: "cat_setups",
  badge: "Best value",
  image: photo("setup-full-1.jpg", "The full setup in a villa bedroom"),
  parts: ["SmartDesk Pro", "Ergonomic Task Chair", 'UltraSharp 27" 4K'],
};

const focusSetup: Card = {
  id: "prd_setup_focus",
  slug: "setup-focus",
  name: "The focus setup",
  tagline: "Desk, keyboard and mouse, ready to write",
  categoryId: "cat_setups",
  image: photo("setup-focus-1.jpg", "The focus setup by a window"),
  parts: ["SmartDesk Pro", "Low-Profile Keyboard", "MX Master 3S"],
};

const studioSetup: Card = {
  id: "prd_setup_studio",
  slug: "setup-studio",
  name: "The studio setup",
  tagline: "Camera-first kit for people on video",
  categoryId: "cat_setups",
  image: photo("setup-studio-1.jpg", "The studio setup with display and webcam"),
  parts: ['Studio Display 27"', "Studio Webcam 4K", "USB-C Hub", "Monitor Riser"],
};

const smartdeskPro: Card = {
  id: "prd_smartdesk_pro",
  slug: "smartdesk-pro",
  name: "SmartDesk Pro",
  tagline: "Electric standing desk with memory presets",
  categoryId: "cat_desks",
  badge: "Most rented",
  image: photo("smartdesk-pro-1.jpg", "SmartDesk Pro electric standing desk"),
};

const mxMaster: Card = {
  id: "prd_mx_master_3s",
  slug: "mx-master-3s",
  name: "MX Master 3S",
  tagline: "8K DPI silent-click productivity mouse",
  categoryId: "cat_accessories",
  image: photo("mx-master-3s-1.jpg", "MX Master 3S mouse"),
};

const ultrawide: Card = {
  id: "prd_ultrawide_34",
  slug: "ultrawide-34",
  name: 'UltraWide 34"',
  tagline: "34-inch curved ultrawide QHD",
  categoryId: "cat_monitors",
  // A broken photo shows the empty frame.
  image: photo("missing.jpg", 'UltraWide 34" curved display'),
};

const result = (
  output: SearchProductsOutput | StartPaymentOutput | ConfirmPaymentOutput,
): CallToolResult => ({
  structuredContent: output,
  content: [{ type: "text", text: JSON.stringify(output) }],
});

// What toToolResult returns for a failed core call.
const toolError = (code: string, message: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
  _meta: { [errorCodeMetaKey]: code },
});

export interface Sample {
  label: string;
  input: Record<string, unknown>;
  result: CallToolResult;
  /**
   * What confirm_payment answers, one per call in order; the last one repeats.
   * Without it the dev host has no confirm_payment.
   */
  confirmPayment?: CallToolResult[];
}

/** search_products results the dev page feeds the Setup picker. */
export const setupPickerSamples: Record<string, Sample> = {
  bali: {
    label: "Bali, with more pages",
    input: { locationId: "loc_bali", limit: 6 },
    result: result({
      items: [
        { ...fullSetup, prices: bali(2500) },
        { ...focusSetup, prices: bali(1500) },
        { ...studioSetup, prices: bali(2100) },
        { ...smartdeskPro, prices: bali(1200) },
        { ...mxMaster, prices: bali(200) },
        { ...ultrawide, prices: bali(1200) },
      ],
      total: 31,
      hasMore: true,
    }),
  },
  everyCity: {
    label: "No city given",
    input: { query: "setup" },
    result: result({
      items: [
        { ...fullSetup, prices: everyCity(2500) },
        { ...focusSetup, prices: everyCity(1500) },
      ],
      total: 2,
      hasMore: false,
    }),
  },
  empty: {
    label: "No results",
    input: { query: "hammock", locationId: "loc_bali" },
    result: result({ items: [], total: 0, hasMore: false }),
  },
  error: {
    label: "Tool error",
    input: { locationId: "loc_nowhere" },
    result: { isError: true, content: [{ type: "text", text: "Location not found." }] },
  },
};

/** What list_locations answers, for each price's currency and city name. */
export const sampleLocations: Location[] = [
  {
    id: "loc_bali",
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    timezone: "Asia/Makassar",
    currency: "USD",
    deliveryFee: 1000,
    status: "active",
  },
  {
    id: "loc_chiang_mai",
    slug: "chiang-mai",
    name: "Chiang Mai",
    country: "Thailand",
    timezone: "Asia/Chiang_Mai",
    currency: "USD",
    deliveryFee: 1000,
    status: "active",
  },
  {
    id: "loc_lisbon",
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    // The seed prices Lisbon in USD; EUR here shows a card mixing currencies.
    currency: "EUR",
    deliveryFee: 1500,
    status: "active",
  },
];

// The rental from the dev seed's checkout: first week, deposit and delivery.
const pendingPayment: CustomerPayment = {
  id: "pay_1",
  rentalId: "rental_1",
  billingCycle: 1,
  provider: "paypal",
  amount: 37000,
  currency: "USD",
  status: "pending",
  createdAt: "2026-11-08T05:00:00.000Z",
};

const paidPayment: CustomerPayment = {
  ...pendingPayment,
  status: "succeeded",
  paidAt: "2026-11-08T05:02:00.000Z",
  updatedAt: "2026-11-08T05:02:00.000Z",
};

const declinedPayment: CustomerPayment = {
  ...pendingPayment,
  status: "failed",
  failureReason: "The payment method was declined. Try another one.",
  updatedAt: "2026-11-08T05:02:00.000Z",
};

const checkoutInput = { number: "AR-2026-7KQ4M2", provider: "paypal" };

const awaitingApproval = result({
  status: "awaiting_approval",
  payment: pendingPayment,
  approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
});

const notApproved = toolError(
  "payment_not_approved",
  "The customer has not approved the payment at the provider yet",
);

/**
 * start_payment results the dev page feeds the PayPal checkout, with what
 * confirm_payment answers its checks. The checkout checks every few seconds once
 * Pay with PayPal is pressed, and at once on I've approved.
 */
export const paypalCheckoutSamples: Record<string, Sample> = {
  approvesSoon: {
    label: "Approves on the third check",
    input: checkoutInput,
    result: awaitingApproval,
    confirmPayment: [notApproved, notApproved, result({ payment: paidPayment })],
  },
  neverApproves: {
    label: "Not approved yet",
    input: checkoutInput,
    result: awaitingApproval,
    confirmPayment: [notApproved],
  },
  declined: {
    label: "Declined",
    input: checkoutInput,
    result: awaitingApproval,
    confirmPayment: [result({ payment: declinedPayment })],
  },
  confirmError: {
    label: "Confirm fails",
    input: checkoutInput,
    result: awaitingApproval,
    confirmPayment: [
      toolError(
        "payment_captured_twice",
        "PayPal charged this order twice. Email hello@async.rent and we'll refund the extra payment.",
      ),
    ],
  },
  alreadyPaid: {
    label: "Already paid",
    input: checkoutInput,
    result: result({ status: "paid", payment: paidPayment }),
  },
  startError: {
    label: "Start fails",
    input: { number: "AR-2026-NOPE00", provider: "paypal" },
    result: toolError("rental_not_found", "Rental AR-2026-NOPE00 not found."),
  },
};

export interface WidgetSamples {
  label: string;
  /** The widget's page under the dev server. */
  src: string;
  samples: Record<string, Sample>;
}

/** Every widget the dev page can show, with its samples. */
export const widgetSamples: Record<string, WidgetSamples> = {
  setupPicker: { label: "Setup picker", src: "/setup-picker/", samples: setupPickerSamples },
  paypalCheckout: {
    label: "PayPal checkout",
    src: "/paypal-checkout/",
    samples: paypalCheckoutSamples,
  },
};
