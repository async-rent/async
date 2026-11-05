import type { Cart, CartItem } from "@async-rent/core";
import { Alert, AlertDescription, AlertTitle } from "@async-rent/ui/components/alert";
import { Avatar, AvatarFallback } from "@async-rent/ui/components/avatar";
import { Button } from "@async-rent/ui/components/button";
import { Separator } from "@async-rent/ui/components/separator";
import { Spinner } from "@async-rent/ui/components/spinner";
import {
  RiArrowRightLine,
  RiCustomerService2Line,
  RiErrorWarningLine,
  RiLockLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";

import { catalogOverviewQueryOptions } from "../../hooks/use-catalog-overview";
import { useRentalPlan } from "../../hooks/use-rental-plan";
import { supportEmail } from "../../lib/checkout";
import { cityLabel } from "../../lib/cities";
import { formatMoney } from "../../lib/money";
import { formatDeliveryDate } from "../../lib/rental-plan";
import { ProductImage } from "../product-image";

const eyebrow = "font-mono text-[10px] tracking-[0.12em] uppercase";

interface OrderSummaryProps {
  cart: Cart;
  /** The form the pay button submits. */
  formId: string;
  /** The order's number once placed, so a retry can say it is saved. */
  placedNumber: string | undefined;
  isSubmitting: boolean;
  error: Error | null;
}

/** What the visitor is renting, what it costs today and every week, and the pay button. */
export function OrderSummary({
  cart,
  formId,
  placedNumber,
  isSubmitting,
  error,
}: OrderSummaryProps) {
  const { location, plan } = useRentalPlan();
  const { summary, currency } = cart;
  const money = (amount: number) => formatMoney(amount, currency);

  // Only available lines become the rental, so only they are listed and priced.
  const lines = cart.items.filter((item) => item.available);
  const left = cart.items.length - lines.length;
  const units = lines.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside aria-labelledby="order-summary-title" className="flex flex-col gap-6 lg:sticky lg:top-8">
      <div className="flex flex-col rounded-xl bg-fog p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id="order-summary-title" className={eyebrow}>
            Your order
          </h2>
          <p className={cn(eyebrow, "text-muted-foreground")}>
            {units === 1 ? "1 item" : `${units} items`}
          </p>
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />
          {cityLabel(location)} · {formatDeliveryDate(plan.deliveryDate)}
        </p>

        <ul className="mt-5 flex flex-col">
          {lines.map((item) => (
            <SummaryLine key={item.productId} item={item} currency={currency} />
          ))}
        </ul>
        {left > 0 && (
          <p className="pt-3 text-[11px] text-muted-foreground">
            {left === 1 ? "1 item" : `${left} items`} in your cart {left === 1 ? "isn't" : "aren't"}{" "}
            available in {location.name} right now and won't be included.
          </p>
        )}

        <dl className="flex flex-col gap-2 pt-5 text-[11.5px]">
          <SummaryRow label="Rent / week" value={money(summary.weeklySubtotal)} mono />
          <SummaryRow
            label="Delivery & setup"
            value={summary.deliveryFee > 0 ? money(summary.deliveryFee) : "Free"}
            mono={summary.deliveryFee > 0}
          />
          <SummaryRow label="Deposit" value={money(summary.deposit)} mono />
          {summary.discount > 0 && (
            <SummaryRow label="Discount" value={`−${money(summary.discount)}`} mono />
          )}
        </dl>

        <Separator className="my-5" />

        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px]">Due today</p>
          <p className="font-mono text-[22px] leading-none tracking-[-0.02em]">
            {money(summary.totalDueToday)}
          </p>
        </div>
        <p className="pt-2 text-[10px] text-muted-foreground">
          {plan.weeks === 1
            ? "One week, charged today."
            : `First week, charged today. Then ${money(summary.weeklySubtotal)} / week for ${plan.weeks - 1} more ${plan.weeks === 2 ? "week" : "weeks"}.`}
        </p>

        {error && (
          <Alert variant="destructive" className="mt-5">
            <RiErrorWarningLine />
            <AlertTitle>
              {placedNumber ? "PayPal didn't open" : "Your order wasn't placed"}
            </AlertTitle>
            <AlertDescription>
              {placedNumber
                ? `Order ${placedNumber} is saved and nothing was charged. ${error.message}`
                : error.message}
            </AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          form={formId}
          size="lg"
          disabled={isSubmitting}
          className="mt-5 h-13 justify-between px-4.5 text-[13.5px] font-normal"
        >
          <span className="flex items-center gap-2">
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {isSubmitting
              ? "Opening PayPal…"
              : placedNumber
                ? "Try PayPal again"
                : "Continue with PayPal"}
          </span>
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            {money(summary.weeklySubtotal)} / week
            <RiArrowRightLine data-icon="inline-end" />
          </span>
        </Button>
        <p className="flex items-center justify-center gap-1.5 pt-3 text-[10px] text-muted-foreground">
          <RiLockLine className="size-3" />
          Secure checkout · {summary.deposit > 0 ? "Refundable deposit" : "No deposit"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback>
            <RiCustomerService2Line className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn(eyebrow, "text-muted-foreground")}>Need a hand?</p>
          <p className="truncate text-[13px]">
            Customer Service ·{" "}
            <a href={`mailto:${supportEmail}`} className="underline-offset-3 hover:underline">
              {supportEmail}
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}

function SummaryLine({ item, currency }: { item: CartItem; currency: string }) {
  const { location } = useRentalPlan();
  // Cart lines carry no spec line; the city's catalog overview has one per product.
  const { data: overview } = useQuery(catalogOverviewQueryOptions(location.id));
  const spec = overview?.productSummaries[item.productId];

  return (
    <li className="flex items-center gap-4 border-b py-3.5 first:border-t">
      <ProductImage
        image={item.images[0]}
        className="size-12 shrink-0 rounded-md border bg-paper"
        imageClassName="size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[13px] leading-4">{item.name}</p>
        {(spec || item.quantity > 1) && (
          <p className="truncate font-mono text-[9.5px] leading-3 tracking-[0.04em] text-muted-foreground uppercase">
            {[spec, item.quantity > 1 ? `× ${item.quantity}` : undefined]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      <p className="shrink-0 font-mono text-xs">
        {formatMoney(item.weeklyPrice * item.quantity, currency)}
      </p>
    </li>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}
