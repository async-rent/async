import { dateSchema, type Location } from "@async-rent/core";
import { z } from "zod";

import { defaultCitySlug } from "./cities";

/** Rental lengths the cart offers. Billing stays weekly whichever one is picked. */
export const rentalWeekOptions = [1, 2, 4] as const;

export const rentalWeeksSchema = z.union([z.literal(1), z.literal(2), z.literal(4)]);

export type RentalWeeks = z.infer<typeof rentalWeeksSchema>;

/**
 * What the visitor has chosen before checkout: the city to rent in, the day
 * the gear arrives and how many weeks they plan to keep it. The cart itself
 * holds none of this (core scopes a cart to a city and leaves dates to the
 * rental), so the storefront keeps it in a cookie the server can read too.
 */
export const rentalPlanSchema = z.object({
  locationId: z.string(),
  deliveryDate: dateSchema,
  weeks: rentalWeeksSchema,
});

export type RentalPlan = z.infer<typeof rentalPlanSchema>;

export const rentalPlanCookie = "async_plan";

const rentalPlanCookieMaxAge = 60 * 60 * 24 * 90;

// Each field falls back on its own, so one stale value never discards the rest.
const storedRentalPlanSchema = z.object({
  locationId: z.string().optional().catch(undefined),
  deliveryDate: dateSchema.optional().catch(undefined),
  weeks: rentalWeeksSchema.optional().catch(undefined),
});

export type StoredRentalPlan = z.infer<typeof storedRentalPlanSchema>;

/** Reads the plan cookie, ignoring anything that does not parse. */
export function parseStoredRentalPlan(raw: string | undefined): StoredRentalPlan {
  if (!raw) return {};

  try {
    const parsed = storedRentalPlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Saves the plan for the next server render. Browser only. */
export function writeRentalPlanCookie(plan: RentalPlan): void {
  const value = encodeURIComponent(JSON.stringify(plan));
  document.cookie = `${rentalPlanCookie}=${value}; Path=/; Max-Age=${rentalPlanCookieMaxAge}; SameSite=Lax`;
}

/** Today's date (YYYY-MM-DD) in a location's time zone. */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Gear is delivered and set up within 24 hours, so the first slot is tomorrow in the city. */
export function earliestDeliveryDate(location: Pick<Location, "timezone">, now: Date): string {
  return addDays(todayIn(location.timezone, now), 1);
}

/** How far ahead a delivery can be booked, counted from the first slot. */
const bookingWindowDays = 60;

/** The last day a delivery can be booked for: an order holds its stock until then. */
export function latestDeliveryDate(location: Pick<Location, "timezone">, now: Date): string {
  return addDays(earliestDeliveryDate(location, now), bookingWindowDays);
}

export interface ResolveRentalPlanInput {
  stored: StoredRentalPlan;
  /** Cities open for rentals. */
  locations: Location[];
  now: Date;
}

export interface ResolvedRentalPlan {
  plan: RentalPlan;
  location: Location;
}

/**
 * Turns whatever the visitor stored into a plan the storefront can render: a
 * city (the stored one, else the default city, else the first one listed),
 * a delivery date inside the city's booking window, and a rental length.
 * Returns `null` when no city is open yet.
 */
export function resolveRentalPlan(input: ResolveRentalPlanInput): ResolvedRentalPlan | null {
  const { stored, locations, now } = input;

  const location =
    locations.find((candidate) => candidate.id === stored.locationId) ??
    locations.find((candidate) => candidate.slug === defaultCitySlug) ??
    locations[0];
  if (!location) return null;

  const earliest = earliestDeliveryDate(location, now);
  const latest = latestDeliveryDate(location, now);
  // ISO dates order the same way as strings.
  const deliveryDate =
    stored.deliveryDate && stored.deliveryDate >= earliest && stored.deliveryDate <= latest
      ? stored.deliveryDate
      : earliest;

  return {
    location,
    plan: { locationId: location.id, deliveryDate, weeks: stored.weeks ?? 1 },
  };
}

/** "Sat, 24 Oct" for a YYYY-MM-DD date. */
export function formatDeliveryDate(date: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(`${date}T00:00:00Z`));

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("weekday")}, ${part("day")} ${part("month")}`;
}

/** A YYYY-MM-DD date as a local midnight `Date`, the shape the calendar works in. */
export function toCalendarDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** A calendar `Date` back to YYYY-MM-DD, reading its local fields. */
export function fromCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
