import type { Location, ProductPrice } from "@async-rent/core";
import { Badge } from "@async-rent/ui/components/badge";
import { Button } from "@async-rent/ui/components/button";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { Spinner } from "@async-rent/ui/components/spinner";
import type { App } from "@modelcontextprotocol/ext-apps/react";
import { RiCheckLine } from "@remixicon/react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import type { ProductSummary, SearchProductsOutput } from "../../tools/search-products";
import { formatMoney } from "../shared/money";
import { errorMessage, structuredResult, useHostedWidget } from "../shared/use-hosted-widget";

/**
 * The search_products results as selectable cards. The customer picks one or more
 * and presses Rent these, which tells the assistant the names and ids. Dates and
 * the quote stay with the assistant, so the picker only shows the page it was given.
 */
export function SetupPicker() {
  const { app, error, toolResult } = useHostedWidget("Setup picker");
  const locations = useLocations(app);

  if (error) return <Notice>Couldn't connect to the chat. {error.message}</Notice>;
  if (!app || !toolResult) {
    return (
      <Notice>
        <Spinner /> Waiting for search results…
      </Notice>
    );
  }

  const failure = errorMessage(toolResult);
  if (failure) return <Notice>{failure}</Notice>;

  const page = structuredResult<SearchProductsOutput>(toolResult);
  if (!page) return <Notice>These search results can't be shown here.</Notice>;

  // A new result is a new search, so it starts with nothing picked.
  const key = page.items.map((product) => product.id).join();

  return <Picker key={key} app={app} page={page} locations={locations} />;
}

type SendState = "idle" | "sending" | "sent" | "failed";

interface PickerProps {
  app: App;
  page: SearchProductsOutput;
  locations: Map<string, Location> | undefined;
}

function Picker({ app, page, locations }: PickerProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [sendState, setSendState] = useState<SendState>("idle");

  const picks = page.items.filter((product) => selectedIds.has(product.id));
  const sending = sendState === "sending";

  function toggle(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(productId)) next.add(productId);
      return next;
    });
    setSendState("idle");
  }

  async function rentPicks() {
    setSendState("sending");
    try {
      const result = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: rentMessage(picks) }],
      });
      setSendState(result.isError ? "failed" : "sent");
    } catch {
      setSendState("failed");
    }
  }

  if (page.items.length === 0) {
    return <Notice>Nothing matched this search. Ask your assistant to try different words.</Notice>;
  }

  return (
    <main className="flex flex-col gap-3 p-3">
      <fieldset className="contents">
        <legend className="sr-only">Choose the gear to rent</legend>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {page.items.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                locations={locations}
                selected={selectedIds.has(product.id)}
                onToggle={() => toggle(product.id)}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {page.hasMore && (
        <p className="text-xs text-muted-foreground">
          Showing {page.items.length} of {page.total}. Ask your assistant for more or different
          results.
        </p>
      )}

      <footer className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {sendStatus(sendState, picks.length)}
        </p>
        <Button disabled={picks.length === 0 || sending} onClick={rentPicks}>
          {sending && <Spinner data-icon="inline-start" />}
          Rent these
        </Button>
      </footer>
    </main>
  );
}

/** One message naming every pick and its id, so the assistant can quote without searching again. */
function rentMessage(picks: ProductSummary[]): string {
  return [
    "I'd like to rent these:",
    ...picks.map((product) => `- ${product.name} (id: ${product.id})`),
  ].join("\n");
}

function sendStatus(state: SendState, pickCount: number): string {
  if (state === "sent") return "Sent to your assistant.";
  if (state === "failed") return "Couldn't send your picks. Try again.";
  if (pickCount === 0) return "Select the gear you want to rent.";

  return `${pickCount} selected`;
}

interface ProductCardProps {
  product: ProductSummary;
  locations: Map<string, Location> | undefined;
  selected: boolean;
  onToggle: () => void;
}

function ProductCard({ product, locations, selected, onToggle }: ProductCardProps) {
  // Only a Setup has parts, even when its parts list is empty.
  const isSetup = product.parts !== undefined;

  return (
    <label className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-card-foreground transition-colors hover:border-ring has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/30 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
      <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} />

      <CardImage image={product.image} scene={isSetup} />

      <span
        aria-hidden="true"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full border bg-background/90 text-transparent transition-colors group-has-checked:border-primary group-has-checked:bg-primary group-has-checked:text-primary-foreground"
      >
        <RiCheckLine className="size-4" />
      </span>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {(isSetup || product.badge) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {isSetup && <Badge variant="soft">Setup</Badge>}
            {product.badge && <Badge variant="outline">{product.badge}</Badge>}
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <p className="text-sm leading-5 font-medium">{product.name}</p>
          <p className="text-xs leading-4 text-muted-foreground">{product.tagline}</p>
        </div>

        {product.parts && product.parts.length > 0 && (
          <p className="text-xs leading-4 text-muted-foreground">
            <span className="text-foreground">Includes</span> {product.parts.join(" · ")}
          </p>
        )}

        <WeeklyPrices prices={product.prices} locations={locations} className="mt-auto pt-1" />
      </div>
    </label>
  );
}

interface CardImageProps {
  image: ProductSummary["image"];
  /** A Setup's photo is a room scene; other photos are cut-outs on a white background. */
  scene: boolean;
}

/** The cover photo on the fog frame; a missing or broken photo leaves the empty frame. */
function CardImage({ image, scene }: CardImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex aspect-4/3 items-center justify-center overflow-hidden bg-fog">
      {image && !failed && (
        <img
          src={image.url}
          // The card's text names the product; the photo's alt would only lengthen the checkbox label.
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            "size-full",
            scene ? "object-cover" : "object-contain p-4 mix-blend-multiply dark:mix-blend-normal",
          )}
        />
      )}
    </div>
  );
}

interface WeeklyPricesProps {
  prices: ProductPrice[];
  locations: Map<string, Location> | undefined;
  className?: string;
}

/** The searched city's weekly price, or one line per city when the search had no city. */
function WeeklyPrices({ prices, locations, className }: WeeklyPricesProps) {
  if (!locations) return <Skeleton className={cn("h-5 w-24", className)} />;

  const price = (entry: ProductPrice) => (
    <>
      <span className="font-medium tabular-nums">
        {formatMoney(entry.weeklyPrice, locations.get(entry.locationId)?.currency)}
      </span>
      <span className="text-xs text-muted-foreground"> / week</span>
    </>
  );

  const [only] = prices;
  if (prices.length === 1 && only) return <p className={cn("text-sm", className)}>{price(only)}</p>;

  return (
    <ul className={cn("flex flex-col gap-0.5 text-sm", className)}>
      {prices.map((entry) => (
        <li key={entry.locationId} className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {locations.get(entry.locationId)?.name ?? entry.locationId}
          </span>
          <span>{price(entry)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Locations by id, for each price's currency and city name. Undefined while
 * loading; empty when the host can't call tools, so prices show without a currency.
 */
function useLocations(app: App | null): Map<string, Location> | undefined {
  const [locations, setLocations] = useState<Map<string, Location>>();

  useEffect(() => {
    if (!app) return;

    let current = true;
    const load = async () => {
      try {
        const result = await app.callServerTool({ name: "list_locations", arguments: {} });
        const listed = structuredResult<{ locations: Location[] }>(result)?.locations ?? [];
        if (current) setLocations(new Map(listed.map((location) => [location.id, location])));
      } catch {
        if (current) setLocations(new Map());
      }
    };
    void load();

    return () => {
      current = false;
    };
  }, [app]);

  return locations;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}
