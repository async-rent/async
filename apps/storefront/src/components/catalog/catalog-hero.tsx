import { Button } from "@async-rent/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@async-rent/ui/components/input-group";
import { Separator } from "@async-rent/ui/components/separator";
import { RiArrowDownSLine, RiArrowRightLine, RiCalendarLine, RiSearchLine } from "@remixicon/react";
import { useState } from "react";

import { useRentalPlan } from "../../hooks/use-rental-plan";
import { formatDeliveryDate } from "../../lib/rental-plan";
import { DeliveryDatePicker } from "../delivery-date-picker";

interface CatalogHeroProps {
  /** The search the page was opened with. */
  query?: string;
  onSearch: (query: string) => void;
}

/** The villa photo with the headline, and the search composer overlapping its bottom edge. */
export function CatalogHero({ query, onSearch }: CatalogHeroProps) {
  return (
    <section className="relative pb-16">
      <div className="relative h-64 overflow-hidden bg-fog">
        <img
          src="/images/hero-bali-villa.jpg"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[50%_64%]"
        />
        <h1 className="relative px-5 pt-21.5 text-center font-heading text-4xl leading-[0.96] tracking-[-0.02em] text-paper drop-shadow-sm sm:text-5xl">
          Your comfy setup, everywhere!
        </h1>
      </div>
      <div className="absolute inset-x-5 bottom-10 mx-auto max-w-205">
        {/* Keyed so a new search from the URL resets the field. */}
        <HeroSearch key={query ?? ""} query={query} onSearch={onSearch} />
      </div>
    </section>
  );
}

function HeroSearch({ query, onSearch }: CatalogHeroProps) {
  const { plan } = useRentalPlan();
  const [value, setValue] = useState(query ?? "");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim());
      }}
      className="flex h-19 items-center gap-1 rounded-xl border bg-paper p-2.5 shadow-[0_20px_50px_rgb(20_20_20/0.22)] sm:gap-2"
    >
      <DeliveryDatePicker
        render={
          <Button
            variant="ghost"
            aria-label={`Delivery date, ${formatDeliveryDate(plan.deliveryDate)}`}
            className="h-14 shrink-0 gap-2.25 px-2 font-normal sm:pr-3 sm:pl-2.5"
          />
        }
      >
        <RiCalendarLine data-icon="inline-start" className="text-muted-foreground" />
        <span className="flex flex-col items-start gap-px pt-px">
          <span className="font-mono text-[9px] leading-2.75 tracking-widest text-muted-foreground uppercase">
            Delivery
          </span>
          <span className="text-[13px] leading-4.25">{formatDeliveryDate(plan.deliveryDate)}</span>
        </span>
        <RiArrowDownSLine
          data-icon="inline-end"
          className="hidden text-muted-foreground sm:block"
        />
      </DeliveryDatePicker>

      <Separator orientation="vertical" className="h-8 self-center" />

      <InputGroup className="h-14 min-w-0 flex-1 border-0 shadow-none">
        <InputGroupAddon>
          <RiSearchLine />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          name="q"
          aria-label="Search equipment"
          placeholder="Search desks, chairs, monitors…"
          maxLength={120}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="text-[13px]"
        />
      </InputGroup>

      <Button
        type="submit"
        size="lg"
        aria-label="Search"
        className="h-14 shrink-0 rounded-lg px-4 text-[13px] font-normal sm:pr-4.5 sm:pl-5"
      >
        <span className="hidden sm:inline">Search</span>
        <RiArrowRightLine data-icon="inline-end" />
      </Button>
    </form>
  );
}
