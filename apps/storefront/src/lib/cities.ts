import type { Location } from "@async-rent/core";

/**
 * Cities the storefront delivers to, mirroring the seeded `locations` rows.
 * The footer lists them as is; everything that rents reads the live locations
 * from the catalog service and only borrows `area`, the neighbourhood shown
 * next to the city, taken from each location's description.
 */
export const cities = [
  { slug: "bali", name: "Bali", country: "Indonesia", area: "Canggu" },
  { slug: "chiang-mai", name: "Chiang Mai", country: "Thailand", area: "Nimman" },
  { slug: "da-nang", name: "Da Nang", country: "Vietnam", area: "My Khe" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", area: "Alfama" },
] as const satisfies ReadonlyArray<Pick<Location, "slug" | "name" | "country"> & { area: string }>;

export type CitySlug = (typeof cities)[number]["slug"];

export const defaultCitySlug: CitySlug = "bali";

/** "Canggu, Bali": the neighbourhood when the storefront knows one, else just the city. */
export function cityLabel(location: Pick<Location, "slug" | "name">): string {
  const area = cities.find((city) => city.slug === location.slug)?.area;
  return area ? `${area}, ${location.name}` : location.name;
}
