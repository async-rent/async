import { z } from "zod";
import { amountSchema, currencyCodeSchema, imageSchema, timestampsSchema } from "./shared";

export const locationStatusSchema = z.enum(["active", "coming_soon"]);

export const locationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  country: z.string(),
  timezone: z.string(),
  description: z.string().optional(),
  currency: currencyCodeSchema,
  deliveryFee: amountSchema,
  status: locationStatusSchema.default("active"),
});

export type Location = z.infer<typeof locationSchema>;

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type Category = z.infer<typeof categorySchema>;

export const productPriceSchema = z.object({
  locationId: z.string(),
  weeklyPrice: amountSchema,
  deposit: amountSchema.optional(),
  stock: z.number().int().nonnegative().optional(),
});

export type ProductPrice = z.infer<typeof productPriceSchema>;

export const productStatusSchema = z.enum(["active", "archived"]);

export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productSpecSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

export const productSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    description: z.string(),
    categoryId: z.string(),
    images: z.array(imageSchema).min(1),
    prices: z.array(productPriceSchema).min(1),
    highlights: z.array(z.string()).default([]),
    specs: z.array(productSpecSchema).default([]),
    badge: z.string().optional(),
    featured: z.boolean().default(false),
    status: productStatusSchema.default("active"),
  })
  .extend(timestampsSchema.shape);

export type Product = z.infer<typeof productSchema>;

export function priceForLocation(product: Product, locationId: string) {
  return product.prices.find((price) => price.locationId === locationId);
}

export function isLocationActive(location: Pick<Location, "status">): boolean {
  return location.status === "active";
}
