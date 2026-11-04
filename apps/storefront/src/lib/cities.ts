import type { Location } from "@async-rent/core";

/**
 * Cities the storefront delivers to, mirroring the seeded `locations` rows.
 * Static until the catalog is wired (#19/#20); `area` is the neighbourhood the
 * header shows next to the city, taken from each location's description.
 */
export const cities = [
  { slug: "bali", name: "Bali", country: "Indonesia", area: "Canggu" },
  { slug: "chiang-mai", name: "Chiang Mai", country: "Thailand", area: "Nimman" },
  { slug: "da-nang", name: "Da Nang", country: "Vietnam", area: "My Khe" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", area: "Alfama" },
] as const satisfies ReadonlyArray<Pick<Location, "slug" | "name" | "country"> & { area: string }>;

export type CitySlug = (typeof cities)[number]["slug"];

export const defaultCitySlug: CitySlug = "bali";
