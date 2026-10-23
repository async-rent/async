import { z } from "zod";
import {
  categorySchema,
  locationSchema,
  priceForLocation,
  productSchema,
  type Product,
  type ProductPrice,
  type ProductSort,
} from "./catalog";
import { cartSchema, type Cart } from "./checkout";
import type { Money } from "../utils";

/**
 * The demo catalog.
 *
 * A real deployment would read this from D1, but the MVP ships with one
 * validated seed so the Storefront and MCP see exactly the same products,
 * weekly prices and stock. Every price is set per city.
 */

export const LOCATION_SLUGS = ["bali", "chiang-mai", "da-nang", "lisbon"] as const;

export type LocationSlug = (typeof LOCATION_SLUGS)[number];

export const DEFAULT_LOCATION_SLUG: LocationSlug = "bali";

export function usd(dollars: number): Money {
  return { amount: Math.round(dollars * 100), currency: "USD" };
}

function perLocation(
  weekly: Record<LocationSlug, number>,
  stock: Record<LocationSlug, number> = {
    bali: 10,
    "chiang-mai": 8,
    "da-nang": 6,
    lisbon: 12,
  },
): ProductPrice[] {
  return LOCATION_SLUGS.map((locationSlug) => ({
    locationSlug,
    weeklyPrice: usd(weekly[locationSlug]),
    deposit: usd(weekly[locationSlug]),
    deliveryFee: usd(0),
    stock: stock[locationSlug],
  }));
}

const categorySeeds = [
  {
    id: "cat_desks",
    slug: "desks",
    name: "Desks",
    description: "Standing desks and compact writing desks.",
    sortOrder: 1,
  },
  {
    id: "cat_chairs",
    slug: "chairs",
    name: "Chairs",
    description: "Ergonomic task chairs for long client days.",
    sortOrder: 2,
  },
  {
    id: "cat_monitors",
    slug: "monitors",
    name: "Monitors",
    description: "Displays and arms that give your laptop a rest.",
    sortOrder: 3,
  },
  {
    id: "cat_accessories",
    slug: "accessories",
    name: "Accessories",
    description: "Keyboards, stands, hubs and desk mats.",
    sortOrder: 4,
  },
  {
    id: "cat_lighting",
    slug: "lighting",
    name: "Lighting",
    description: "Warm light for late calls and early starts.",
    sortOrder: 5,
  },
  {
    id: "cat_plants",
    slug: "plants",
    name: "Plants",
    description: "Something alive for the corner of the room.",
    sortOrder: 6,
  },
];

export const categories = categorySeeds.map((category) => categorySchema.parse(category));

function categoryRef(slug: string) {
  const category = categories.find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Unknown category: ${slug}`);
  }

  return { id: category.id, slug: category.slug, name: category.name };
}

const locationSeeds = [
  {
    id: "loc_bali",
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    timezone: "Asia/Makassar",
    description: "Canggu, Ubud and Uluwatu.",
  },
  {
    id: "loc_chiang_mai",
    slug: "chiang-mai",
    name: "Chiang Mai",
    country: "Thailand",
    timezone: "Asia/Bangkok",
    description: "Nimman, the Old City and Riverside.",
  },
  {
    id: "loc_da_nang",
    slug: "da-nang",
    name: "Da Nang",
    country: "Vietnam",
    timezone: "Asia/Ho_Chi_Minh",
    description: "An Thuong, Son Tra and Hoi An.",
  },
  {
    id: "loc_lisbon",
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    description: "Príncipe Real, Alfama and Cais do Sodré.",
  },
];

export const locations = locationSeeds.map((location) => locationSchema.parse(location));

export const DEFAULT_DELIVERY_WINDOW = { start: "10:00", end: "12:00" } as const;

const productSeeds = [
  {
    id: "prd_smartdesk",
    slug: "smartdesk-pro",
    name: "SmartDesk Pro",
    tagline: "Electric standing desk with four memory presets.",
    description:
      "A quiet dual-motor desk that moves from sitting to standing in seconds. The bamboo top is wide enough for a monitor, laptop and a second coffee.",
    category: categoryRef("desks"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1400&q=80",
        alt: "A light wood standing desk in a bright room",
      },
    ],
    prices: perLocation(
      { bali: 29, "chiang-mai": 27, "da-nang": 25, lisbon: 39 },
      { bali: 14, "chiang-mai": 10, "da-nang": 8, lisbon: 16 },
    ),
    highlights: ["Electric", "120 × 70 cm", "Four presets"],
    specs: [
      { label: "Height range", value: "62–128 cm" },
      { label: "Top", value: "Bamboo, 120 × 70 cm" },
      { label: "Motor", value: "Dual, under 45 dB" },
    ],
    badge: "Most rented",
    featured: true,
  },
  {
    id: "prd_taskchair",
    slug: "ergo-task-chair",
    name: "Ergo Task Chair",
    tagline: "A mesh chair that makes a six-hour call feel shorter.",
    description:
      "Adjustable lumbar support, a breathable mesh back and arms that actually fit under a desk. Delivered assembled so you can sit down the same day.",
    category: categoryRef("chairs"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&w=1400&q=80",
        alt: "An ergonomic mesh office chair",
      },
    ],
    prices: perLocation(
      { bali: 24, "chiang-mai": 22, "da-nang": 20, lisbon: 34 },
      { bali: 18, "chiang-mai": 12, "da-nang": 10, lisbon: 20 },
    ),
    highlights: ["Mesh back", "Lumbar support", "Assembled"],
    specs: [
      { label: "Seat height", value: "44–54 cm" },
      { label: "Weight limit", value: "120 kg" },
      { label: "Adjustment", value: "4D arms, tilt lock" },
    ],
    featured: true,
  },
  {
    id: "prd_monitor27",
    slug: "studio-monitor-27",
    name: "Studio Monitor 27",
    tagline: "A 4K display with room for two windows side by side.",
    description:
      "27 inches of calm, color-accurate screen. USB-C carries power and video, so one cable turns a dining table into a desk.",
    category: categoryRef("monitors"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1400&q=80",
        alt: "A large monitor on a desk",
      },
    ],
    prices: perLocation(
      { bali: 19, "chiang-mai": 17, "da-nang": 16, lisbon: 27 },
      { bali: 12, "chiang-mai": 9, "da-nang": 7, lisbon: 14 },
    ),
    highlights: ["27-inch 4K", "USB-C 90 W", "Height adjustable"],
    specs: [
      { label: "Resolution", value: "3840 × 2160" },
      { label: "Panel", value: "IPS, 99% sRGB" },
      { label: "Ports", value: "USB-C, HDMI, 2 × USB-A" },
    ],
    featured: true,
  },
  {
    id: "prd_monitorarm",
    slug: "monitor-arm",
    name: "Monitor Arm",
    tagline: "Lift the screen and take back the desk underneath it.",
    description:
      "A gas-spring arm that holds a 27-inch display steady at eye level. Clamps to the desk edge without drilling.",
    category: categoryRef("monitors"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=1400&q=80",
        alt: "A monitor on an adjustable arm above a desk",
      },
    ],
    prices: perLocation(
      { bali: 8, "chiang-mai": 7, "da-nang": 7, lisbon: 11 },
      { bali: 20, "chiang-mai": 15, "da-nang": 10, lisbon: 22 },
    ),
    highlights: ["Gas spring", "VESA 75/100", "Desk clamp"],
    specs: [
      { label: "Screen size", value: "Up to 32 inches" },
      { label: "Load", value: "2–9 kg" },
      { label: "Reach", value: "Up to 52 cm" },
    ],
  },
  {
    id: "prd_keyboard",
    slug: "mechanical-keyboard",
    name: "Mechanical Keyboard",
    tagline: "Quiet tactile keys for long writing days.",
    description:
      "A compact 75% board with hot-swappable switches and a Mac/Windows toggle. Comes paired and ready, or use the cable.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1400&q=80",
        alt: "A compact mechanical keyboard on a desk",
      },
    ],
    prices: perLocation(
      { bali: 9, "chiang-mai": 8, "da-nang": 8, lisbon: 13 },
      { bali: 16, "chiang-mai": 12, "da-nang": 8, lisbon: 18 },
    ),
    highlights: ["75% layout", "Hot-swappable", "Bluetooth + USB-C"],
    specs: [
      { label: "Layout", value: "75%, US ANSI" },
      { label: "Switches", value: "Tactile brown" },
      { label: "Battery", value: "Up to 3 months" },
    ],
  },
  {
    id: "prd_lamp",
    slug: "warm-desk-lamp",
    name: "Warm Desk Lamp",
    tagline: "A small pool of warm light for late calls.",
    description:
      "Dimmable, adjustable and kind to a laptop camera. The warm setting keeps the room from looking like an office at midnight.",
    category: categoryRef("lighting"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1400&q=80",
        alt: "A warm desk lamp on a wooden table",
      },
    ],
    prices: perLocation(
      { bali: 6, "chiang-mai": 5, "da-nang": 5, lisbon: 8 },
      { bali: 24, "chiang-mai": 18, "da-nang": 12, lisbon: 26 },
    ),
    highlights: ["Dimmable", "Warm 2700K", "USB-C powered"],
    specs: [
      { label: "Color temperature", value: "2700–4000 K" },
      { label: "Power", value: "8 W" },
      { label: "Reach", value: "42 cm" },
    ],
  },
  {
    id: "prd_plant",
    slug: "standing-plant",
    name: "Standing Plant",
    tagline: "A tall, forgiving plant for the corner of the room.",
    description:
      "A mature rubber plant in a stone pot. It tolerates a week away and makes a video call background feel less like a hotel room.",
    category: categoryRef("plants"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1400&q=80",
        alt: "A tall green plant in a stone pot",
      },
    ],
    prices: perLocation(
      { bali: 5, "chiang-mai": 4, "da-nang": 4, lisbon: 7 },
      { bali: 12, "chiang-mai": 8, "da-nang": 6, lisbon: 10 },
    ),
    highlights: ["120–140 cm", "Low light", "Stone pot included"],
    specs: [
      { label: "Height", value: "120–140 cm" },
      { label: "Light", value: "Low to bright indirect" },
      { label: "Water", value: "Every 10–14 days" },
    ],
  },
  {
    id: "prd_laptopstand",
    slug: "laptop-stand",
    name: "Laptop Stand",
    tagline: "Bring the laptop screen up to eye level.",
    description:
      "A folding aluminum stand with six height positions. Packs flat when you move villas.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1400&q=80",
        alt: "A laptop on an aluminum stand",
      },
    ],
    prices: perLocation(
      { bali: 6, "chiang-mai": 5, "da-nang": 5, lisbon: 8 },
      { bali: 22, "chiang-mai": 16, "da-nang": 10, lisbon: 24 },
    ),
    highlights: ["Folds flat", "6 heights", "Aluminum"],
    specs: [
      { label: "Fits", value: "11–17 inch laptops" },
      { label: "Load", value: "Up to 8 kg" },
      { label: "Weight", value: "0.9 kg" },
    ],
  },
  {
    id: "prd_footrest",
    slug: "footrest",
    name: "Footrest",
    tagline: "A small thing that fixes a long afternoon.",
    description:
      "An adjustable footrest with a gentle rock. It takes pressure off your lower back when the chair is not quite perfect.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
        alt: "A footrest under a desk",
      },
    ],
    prices: perLocation(
      { bali: 5, "chiang-mai": 4, "da-nang": 4, lisbon: 7 },
      { bali: 15, "chiang-mai": 10, "da-nang": 8, lisbon: 16 },
    ),
    highlights: ["Adjustable", "Gentle rock", "Non-slip"],
    specs: [
      { label: "Height", value: "9–14 cm" },
      { label: "Angle", value: "0–15°" },
      { label: "Surface", value: "Washable cushion" },
    ],
  },
  {
    id: "prd_deskmat",
    slug: "desk-mat",
    name: "Desk Mat",
    tagline: "A quiet surface for the keyboard, mouse and coffee.",
    description:
      "A generous felt mat that keeps the desk from feeling like a borrowed table. Rolls up when you move.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
        alt: "A felt desk mat with a keyboard",
      },
    ],
    prices: perLocation(
      { bali: 4, "chiang-mai": 3, "da-nang": 3, lisbon: 5 },
      { bali: 30, "chiang-mai": 20, "da-nang": 14, lisbon: 30 },
    ),
    highlights: ["90 × 40 cm", "Felt + cork", "Rolls up"],
    specs: [
      { label: "Size", value: "90 × 40 cm" },
      { label: "Material", value: "Wool felt, cork base" },
      { label: "Care", value: "Spot clean" },
    ],
  },
  {
    id: "prd_webcam",
    slug: "4k-webcam",
    name: "4K Webcam",
    tagline: "Look sharp on the client call without a laptop shuffle.",
    description:
      "A 4K camera with a privacy shutter and a clip that fits a monitor or a laptop lid. The built-in mic is good enough for a one-to-one.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=1400&q=80",
        alt: "A webcam clipped to a monitor",
      },
    ],
    prices: perLocation(
      { bali: 8, "chiang-mai": 7, "da-nang": 7, lisbon: 11 },
      { bali: 10, "chiang-mai": 8, "da-nang": 5, lisbon: 12 },
    ),
    highlights: ["4K 30fps", "Privacy shutter", "Dual mic"],
    specs: [
      { label: "Video", value: "4K at 30 fps" },
      { label: "Field of view", value: "90°" },
      { label: "Mount", value: "Monitor clip + tripod thread" },
    ],
  },
  {
    id: "prd_usbhub",
    slug: "usb-c-hub",
    name: "USB-C Hub",
    tagline: "One cable for the screen, the camera and the charger.",
    description:
      "Seven ports in a small aluminum block: HDMI, USB-C power, two USB-A, SD, microSD and Ethernet. Keeps the desk from becoming a cable drawer.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?auto=format&fit=crop&w=1400&q=80",
        alt: "A USB-C hub connected to a laptop",
      },
    ],
    prices: perLocation(
      { bali: 7, "chiang-mai": 6, "da-nang": 6, lisbon: 9 },
      { bali: 18, "chiang-mai": 14, "da-nang": 8, lisbon: 20 },
    ),
    highlights: ["7 ports", "100 W passthrough", "Ethernet"],
    specs: [
      { label: "Video", value: "HDMI 4K at 60 Hz" },
      { label: "Power", value: "100 W USB-C PD" },
      { label: "Data", value: "2 × USB-A, SD, microSD" },
    ],
  },
  {
    id: "prd_acoustic",
    slug: "acoustic-panel-set",
    name: "Acoustic Panel Set",
    tagline: "Soften the echo before the next client call.",
    description:
      "Six felt panels that take the edge off a tiled room. Mount with the included strips or lean them against the wall.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80",
        alt: "Acoustic panels on a studio wall",
      },
    ],
    prices: perLocation(
      { bali: 12, "chiang-mai": 10, "da-nang": 10, lisbon: 16 },
      { bali: 8, "chiang-mai": 6, "da-nang": 4, lisbon: 10 },
    ),
    highlights: ["Six panels", "Felt", "No drilling"],
    specs: [
      { label: "Panels", value: "6 × 30 × 30 cm" },
      { label: "Material", value: "Recycled PET felt" },
      { label: "Mounting", value: "Adhesive strips included" },
    ],
  },
  {
    id: "prd_microphone",
    slug: "compact-microphone",
    name: "Compact Microphone",
    tagline: "A USB mic that makes the room sound intentional.",
    description:
      "Cardioid USB microphone with a mute button and a headphone jack. Sits on the desk without a boom arm.",
    category: categoryRef("accessories"),
    images: [
      {
        url: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1400&q=80",
        alt: "A compact USB microphone on a desk",
      },
    ],
    prices: perLocation(
      { bali: 10, "chiang-mai": 9, "da-nang": 9, lisbon: 14 },
      { bali: 7, "chiang-mai": 5, "da-nang": 0, lisbon: 9 },
    ),
    highlights: ["USB-C", "Cardioid", "Mute button"],
    specs: [
      { label: "Pattern", value: "Cardioid" },
      { label: "Sample rate", value: "24-bit / 96 kHz" },
      { label: "Monitor", value: "3.5 mm headphone jack" },
    ],
  },
] satisfies z.input<typeof productSchema>[];

export const products: Product[] = productSeeds.map((product) => productSchema.parse(product));

export type CatalogItem = {
  product: Product;
  price: ProductPrice;
};

export function getLocation(slug: string) {
  return locations.find((location) => location.slug === slug);
}

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

/** A product plus the price for the city being browsed. */
export function getCatalogItem(slug: string, locationSlug: string): CatalogItem | undefined {
  const product = getProduct(slug);
  if (!product || product.status !== "active") {
    return undefined;
  }

  const price = priceForLocation(product, locationSlug);
  return price ? { product, price } : undefined;
}

export type CatalogFilters = {
  locationSlug: string;
  categorySlug?: string;
  q?: string;
  maxWeeklyPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

/**
 * The single search used by the Storefront and, later, MCP.
 *
 * Only active products with a price row for the chosen city are returned.
 * Out-of-stock products stay in the catalog but are marked by their price row.
 */
export function searchCatalog(filters: CatalogFilters) {
  const query = filters.q?.trim().toLowerCase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 12;

  const items = products
    .filter((product) => product.status === "active")
    .flatMap((product) => {
      const price = priceForLocation(product, filters.locationSlug);
      return price ? [{ product, price }] : [];
    })
    .filter(({ product, price }) => {
      if (filters.categorySlug && product.category.slug !== filters.categorySlug) {
        return false;
      }

      if (
        filters.maxWeeklyPrice !== undefined &&
        price.weeklyPrice.amount > filters.maxWeeklyPrice
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        product.name,
        product.tagline,
        product.description,
        product.category.name,
        ...product.highlights,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => sortCatalog(a, b, filters.sort ?? "featured"));

  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

function sortCatalog(a: CatalogItem, b: CatalogItem, sort: ProductSort) {
  switch (sort) {
    case "price_asc":
      return a.price.weeklyPrice.amount - b.price.weeklyPrice.amount;
    case "price_desc":
      return b.price.weeklyPrice.amount - a.price.weeklyPrice.amount;
    case "name_asc":
      return a.product.name.localeCompare(b.product.name);
    case "newest":
      return products.indexOf(b.product) - products.indexOf(a.product);
    case "featured":
    default:
      return (
        Number(b.product.featured) - Number(a.product.featured) ||
        a.product.name.localeCompare(b.product.name)
      );
  }
}

/** Resolve a set of product ids into a priced cart for one city. */
export function quoteCart(
  locationSlug: string,
  lines: { productId: string; quantity: number }[],
  id = `cart_${crypto.randomUUID()}`,
): Cart {
  if (lines.length === 0) {
    throw new Error("Cart must contain at least one item.");
  }

  const items = lines.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product || product.status !== "active") {
      throw new Error(`Product not found: ${line.productId}`);
    }

    const price = priceForLocation(product, locationSlug);
    if (!price) {
      throw new Error(`${product.name} is not available in ${locationSlug}.`);
    }

    if (line.quantity < 1) {
      throw new Error("Quantity must be at least 1.");
    }

    if (price.stock !== undefined && price.stock < line.quantity) {
      throw new Error(`Only ${price.stock} ${product.name} left in ${locationSlug}.`);
    }

    return {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: product.images[0],
      quantity: line.quantity,
      weeklyPrice: price.weeklyPrice,
      deposit: price.deposit,
      deliveryFee: price.deliveryFee,
    };
  });

  const currency = items[0]?.weeklyPrice.currency ?? "USD";
  const weeklySubtotal = items.reduce(
    (total, item) => total + item.weeklyPrice.amount * item.quantity,
    0,
  );
  const deposit = items.reduce(
    (total, item) => total + (item.deposit?.amount ?? 0) * item.quantity,
    0,
  );
  const deliveryFee = Math.max(0, ...items.map((item) => item.deliveryFee?.amount ?? 0));

  return cartSchema.parse({
    id,
    locationSlug,
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      image: item.image,
      quantity: item.quantity,
      weeklyPrice: item.weeklyPrice,
      deposit: item.deposit,
    })),
    summary: {
      currency,
      weeklySubtotal,
      deposit,
      deliveryFee,
      discount: 0,
      totalDueToday: weeklySubtotal + deposit + deliveryFee,
      recurringWeekly: weeklySubtotal,
    },
  });
}
