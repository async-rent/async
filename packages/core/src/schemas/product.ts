import { z } from "zod";
import { imageSchema } from "./image";
import { amountSchema } from "./money";
import { timestampsSchema } from "./time";

export const productPriceSchema = z.object({
  locationId: z.string().describe("Location this price applies to."),
  weeklyPrice: amountSchema.describe("Rental price per week at this location."),
  deposit: amountSchema.optional().describe("Refundable deposit charged once at checkout."),
  stock: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Units available at this location; omit when stock is not tracked."),
});

export type ProductPrice = z.infer<typeof productPriceSchema>;

export const productStatusSchema = z
  .enum(["active", "archived"])
  .describe("Archived products stay in the database but are hidden from the catalog.");

export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productSpecSchema = z.object({
  label: z.string().describe("Spec name, e.g. Height range."),
  value: z.string().describe("Spec value as display text, e.g. 62–128 cm."),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productSchema = z
  .object({
    id: z.string(),
    slug: z.string().describe("URL-safe route key, e.g. smartdesk-pro."),
    name: z.string(),
    tagline: z.string().describe("One-line summary shown on cards."),
    description: z.string().describe("Long-form copy shown on the product page."),
    categoryId: z.string(),
    images: z.array(imageSchema).min(1).describe("Display images, first one is the cover."),
    prices: z.array(productPriceSchema).min(1).describe("One price entry per location."),
    highlights: z.array(z.string()).default([]).describe("Short selling points shown as a list."),
    specs: z.array(productSpecSchema).default([]),
    badge: z.string().optional().describe("Optional marketing label, e.g. Most rented."),
    featured: z.boolean().default(false).describe("Featured products sort first in search."),
    status: productStatusSchema.default("active"),
  })
  .extend(timestampsSchema.shape);

export type Product = z.infer<typeof productSchema>;
