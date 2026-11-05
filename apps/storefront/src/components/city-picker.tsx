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
import { cn } from "cn";

import { useRentalPlan } from "../hooks/use-rental-plan";
import { cityLabel } from "../lib/cities";

interface CityPickerProps {
  className?: string;
}

/**
 * The visitor's delivery city. Options are the open locations from the
 * catalog service; picking one switches prices and the cart to that city.
 */
export function CityPicker({ className }: CityPickerProps) {
  const { locations, plan, setLocationId } = useRentalPlan();
  const labels = Object.fromEntries(
    locations.map((location) => [location.id, cityLabel(location)]),
  );

  return (
    <Select
      items={labels}
      value={plan.locationId}
      onValueChange={(value) => {
        if (typeof value === "string") setLocationId(value);
      }}
    >
      <SelectTrigger
        aria-label="Delivery city"
        className={cn(
          "h-10 gap-2 rounded-full border-transparent px-3.5 text-xs shadow-none hover:bg-muted data-[size=default]:h-10",
          className,
        )}
      >
        <RiMapPinLine className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="min-w-52">
        <SelectGroup>
          <SelectLabel>Deliver to</SelectLabel>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
              <span className="text-muted-foreground">{location.country}</span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
