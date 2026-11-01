import { z } from "zod";
import { amountSchema, currencyCodeSchema } from "./money";

export const locationStatusSchema = z
  .enum(["active", "coming_soon"])
  .describe("Whether the location is open for rentals or announced for later.");

export type LocationStatus = z.infer<typeof locationStatusSchema>;

export const locationSchema = z.object({
  id: z.string(),
  slug: z.string().describe("URL-safe route key, e.g. ko-tao."),
  name: z.string(),
  country: z.string(),
  timezone: z
    .string()
    .describe("IANA time zone name the location operates in, e.g. Asia/Makassar."),
  description: z.string().optional(),
  currency: currencyCodeSchema,
  deliveryFee: amountSchema.describe("Delivery fee charged per rental in this location."),
  status: locationStatusSchema.default("active"),
});

export type Location = z.infer<typeof locationSchema>;
