import type { Location } from "@async-rent/core";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ProductSummary, SearchProductsOutput } from "../../tools/search-products";

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

const result = (output: SearchProductsOutput): CallToolResult => ({
  structuredContent: output,
  content: [{ type: "text", text: JSON.stringify(output) }],
});

export interface Sample {
  label: string;
  input: Record<string, unknown>;
  result: CallToolResult;
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
