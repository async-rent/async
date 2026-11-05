import type { Location } from "@async-rent/core";

/**
 * Cities the storefront delivers to, mirroring the seeded `locations` rows.
 * The footer lists them as is; everything that rents reads the live locations
 * from the catalog service and only borrows `area`, the neighbourhood shown
 * next to the city, taken from each location's description, and `countryCode`,
 * which a delivery address needs and a location only names in words.
 */
export const cities = [
  { slug: "bali", name: "Bali", country: "Indonesia", countryCode: "ID", area: "Canggu" },
  {
    slug: "chiang-mai",
    name: "Chiang Mai",
    country: "Thailand",
    countryCode: "TH",
    area: "Nimman",
  },
  { slug: "da-nang", name: "Da Nang", country: "Vietnam", countryCode: "VN", area: "My Khe" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", countryCode: "PT", area: "Alfama" },
] as const satisfies ReadonlyArray<
  Pick<Location, "slug" | "name" | "country"> & {
    /** ISO 3166-1 alpha-2 code a delivery address in the city carries. */
    countryCode: string;
    area: string;
  }
>;

export type CitySlug = (typeof cities)[number]["slug"];

export const defaultCitySlug: CitySlug = "bali";

/** The country code of a delivery address in this city, or `undefined` for a city the storefront doesn't list. */
export function countryCodeOf(location: Pick<Location, "slug">): string | undefined {
  return cities.find((city) => city.slug === location.slug)?.countryCode;
}

/** "Canggu, Bali": the neighbourhood when the storefront knows one, else just the city. */
export function cityLabel(location: Pick<Location, "slug" | "name">): string {
  const area = cities.find((city) => city.slug === location.slug)?.area;
  return area ? `${area}, ${location.name}` : location.name;
}
