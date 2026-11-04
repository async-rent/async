import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@async-rent/ui/components/select";
import { RiMapPinLine } from "@remixicon/react";

import { cities, defaultCitySlug } from "../lib/cities";

const cityLabels = Object.fromEntries(
  cities.map((city) => [city.slug, `${city.area}, ${city.name}`]),
);

/**
 * Header city picker. Holds the choice locally until the catalog reads it
 * (#19/#20); the options are the seeded delivery cities.
 */
export function CityPicker() {
  return (
    <Select items={cityLabels} defaultValue={defaultCitySlug}>
      <SelectTrigger
        aria-label="Delivery city"
        className="h-10 gap-2 rounded-full border-transparent px-3.5 text-xs shadow-none hover:bg-muted data-[size=default]:h-10"
      >
        <RiMapPinLine className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="min-w-52">
        <SelectGroup>
          <SelectLabel>Deliver to</SelectLabel>
          {cities.map((city) => (
            <SelectItem key={city.slug} value={city.slug}>
              {city.name}
              <span className="text-muted-foreground">{city.country}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
