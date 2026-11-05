import { Badge } from "@async-rent/ui/components/badge";
import { Button } from "@async-rent/ui/components/button";
import { Spinner } from "@async-rent/ui/components/spinner";
import { RiArrowRightLine } from "@remixicon/react";

import { useCartActions } from "../../hooks/use-cart";
import type { Bundle, CatalogOverview } from "../../lib/catalog-overview";
import { formatMoney } from "../../lib/money";

const numberWords = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

interface BundlesProps {
  overview: CatalogOverview;
}

/** The ready-made setups: one photo of the first setup beside every setup with its weekly price. */
export function Bundles({ overview }: BundlesProps) {
  const { bundles, currency, deliveryFee } = overview;
  const [featured] = bundles;
  if (!featured) return null;

  const money = (amount: number) => formatMoney(amount, currency);
  const count = numberWords[bundles.length - 1] ?? String(bundles.length);

  return (
    <section
      aria-labelledby="bundles"
      className="mx-auto flex w-full max-w-360 flex-col gap-5 px-5 pb-16 md:px-10 xl:px-20"
    >
      <h2 id="bundles" className="font-heading text-3xl leading-[1.3] tracking-[-0.01em] text-ink">
        Bundles
      </h2>

      <div className="flex flex-col overflow-hidden rounded-xl border bg-paper lg:h-120 lg:flex-row">
        <div className="relative h-72 shrink-0 bg-fog sm:h-96 lg:h-auto lg:flex-1">
          {featured.image && (
            <img
              src={featured.image.url}
              alt={featured.image.alt ?? ""}
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <Badge
            variant="outline"
            className="absolute bottom-6 left-6 h-8 gap-2 rounded-full border-0 bg-paper px-3 font-mono text-[8.5px] font-normal tracking-widest uppercase"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {featured.name} · From {money(featured.weeklyPrice)} / week
          </Badge>
        </div>

        <div className="flex flex-col justify-between gap-6 p-6 sm:p-9 lg:flex-1">
          <div className="flex flex-col">
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[9px] leading-3 tracking-[0.12em] text-primary uppercase">
                Choose your setup
              </p>
              <h3 className="font-heading text-[28px] leading-[1.1] tracking-[-0.01em] text-ink">
                One delivery. The whole desk.
              </h3>
              <p className="text-[12.5px] leading-4.5 text-muted-foreground">
                {count} ready-made {bundles.length === 1 ? "setup" : "setups"}.
              </p>
            </div>
            <ul className="flex flex-col pt-4">
              {bundles.map((bundle) => (
                <BundleRow key={bundle.id} bundle={bundle} money={money} />
              ))}
            </ul>
          </div>

          <p className="flex items-center gap-2 font-mono text-[8px] leading-2.75 tracking-[0.06em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.25 shrink-0 rounded-full bg-primary" />
            {deliveryFee > 0
              ? `Delivery + setup ${money(deliveryFee)}, once per order`
              : "Free delivery + setup"}
          </p>
        </div>
      </div>
    </section>
  );
}

interface BundleRowProps {
  bundle: Bundle;
  money: (amount: number) => string;
}

function BundleRow({ bundle, money }: BundleRowProps) {
  const { addToCart, addingProductId } = useCartActions();
  const adding = addingProductId === bundle.id;

  return (
    <li className="flex items-start justify-between gap-5 py-6 not-first:border-t">
      <div className="flex min-w-0 flex-col gap-1.25">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-heading text-lg leading-5.5 text-ink">{bundle.name}</h4>
          {bundle.weeklySaving !== undefined && (
            <Badge
              variant="soft"
              className="h-4 px-1.5 font-mono text-[7.5px] font-normal tracking-[0.06em] uppercase"
            >
              Save {money(bundle.weeklySaving)} / week
            </Badge>
          )}
        </div>
        <p className="text-[11px] leading-3.75 text-muted-foreground">{bundle.parts.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="flex items-baseline gap-1">
          <span className="font-mono text-xl leading-6 text-ink">{money(bundle.weeklyPrice)}</span>
          <span className="font-mono text-[8px] leading-2.5 tracking-[0.06em] text-muted-foreground uppercase">
            / week
          </span>
        </p>
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0 text-[11px] font-normal"
          disabled={adding}
          aria-label={`Add ${bundle.name} to cart`}
          onClick={() => addToCart(bundle.id)}
        >
          Add bundle
          {adding ? (
            <Spinner data-icon="inline-end" />
          ) : (
            <RiArrowRightLine data-icon="inline-end" />
          )}
        </Button>
      </div>
    </li>
  );
}
