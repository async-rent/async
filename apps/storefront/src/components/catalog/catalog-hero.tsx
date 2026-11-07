import { Button } from "@async-rent/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@async-rent/ui/components/input-group";
import { Separator } from "@async-rent/ui/components/separator";
import { RiArrowDownSLine, RiArrowRightLine, RiCalendarLine, RiSearchLine } from "@remixicon/react";
import { cn } from "cn";
import { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";

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
  const { slotRef, searchRef, stuck } = useSearchPin();

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
      {/* The slot keeps its height while the search is pinned, so nothing below moves. */}
      <div ref={slotRef} className="absolute inset-x-5 bottom-10 mx-auto h-19 max-w-205">
        {/* Once scrolled nearly out of view, the search pins to the top at the page's width. */}
        <div className={cn(stuck && "fixed inset-x-0 top-3 z-40")}>
          <div className={cn(stuck && "mx-auto w-full max-w-360 px-5 md:px-10 xl:px-20")}>
            {/* Keyed so a new search from the URL resets the field. */}
            <HeroSearch
              key={query ?? ""}
              ref={searchRef}
              query={query}
              onSearch={onSearch}
              stuck={stuck}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The share of the search that may still show before it pins to the top. */
const pinBelowVisibleRatio = 0.25;

// The search moves and widens in one go, from wherever it is when the pin
// flips. A strong ease-out answers the scroll at once and settles softly.
const pinDuration = 250;
const pinEasing = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Pins the search once the page scrolls it nearly out of view, and unpins it
 * on the way back. Each switch animates the search from the box it had to
 * the box it gets (a FLIP), so it visibly grows into the top bar and shrinks
 * back into the hero instead of jumping.
 */
function useSearchPin() {
  const slotRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const [stuck, setStuck] = useState(false);
  const stuckRef = useRef(false);
  // Where the search was drawn just before the switch, mid-animation included.
  const fromRect = useRef<DOMRect | null>(null);
  const animation = useRef<Animation | null>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const next =
          entry.intersectionRatio < pinBelowVisibleRatio && entry.boundingClientRect.top < 0;
        if (next === stuckRef.current) return;

        stuckRef.current = next;
        fromRect.current = searchRef.current?.getBoundingClientRect() ?? null;
        setStuck(next);
      },
      { threshold: [0, pinBelowVisibleRatio, 1] },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  // Runs before paint, so the search never shows a frame in its new box unanimated.
  useLayoutEffect(() => {
    const search = searchRef.current;
    const from = fromRect.current;
    fromRect.current = null;
    if (!search || !from) return;

    // Measure the new box without the transform of a switch still in flight.
    animation.current?.cancel();
    const to = search.getBoundingClientRect();
    // A fast flick (or a page restored far down) leaves the search well above
    // the window; it still drops in from just past the top edge.
    const fromTop = Math.max(from.top, -from.height);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animation.current = reduceMotion
      ? search.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: "ease" })
      : search.animate(
          [
            {
              width: `${from.width}px`,
              transform: `translate(${from.left - to.left}px, ${fromTop - to.top}px)`,
            },
            { width: `${to.width}px`, transform: "translate(0, 0)" },
          ],
          { duration: pinDuration, easing: pinEasing },
        );
  }, [stuck]);

  return { slotRef, searchRef, stuck };
}

interface HeroSearchProps extends CatalogHeroProps {
  ref: Ref<HTMLFormElement>;
  /** Pinned to the top of the window, where a lighter shadow keeps it from looming. */
  stuck: boolean;
}

function HeroSearch({ ref, query, onSearch, stuck }: HeroSearchProps) {
  const { plan } = useRentalPlan();
  const [value, setValue] = useState(query ?? "");

  return (
    <form
      ref={ref}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value.trim());
      }}
      className={cn(
        "flex h-19 items-center gap-1 rounded-xl border bg-paper p-2.5 shadow-[0_20px_50px_rgb(20_20_20/0.22)] transition-shadow duration-250 ease-out sm:gap-2",
        stuck && "shadow-[0_12px_32px_rgb(20_20_20/0.16)]",
      )}
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
