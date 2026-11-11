import { Alert, AlertDescription, AlertTitle } from "@async-rent/ui/components/alert";
import { Avatar, AvatarFallback } from "@async-rent/ui/components/avatar";
import { Button } from "@async-rent/ui/components/button";
import { Separator } from "@async-rent/ui/components/separator";
import { Spinner } from "@async-rent/ui/components/spinner";
import {
  RiArrowRightLine,
  RiCustomerService2Line,
  RiErrorWarningLine,
  RiInformationLine,
  RiLockLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";

import type { CheckoutError } from "../../hooks/use-checkout";
import { catalogOverviewQueryOptions } from "../../hooks/use-catalog-overview";
import { useRentalPlan } from "../../hooks/use-rental-plan";
import { supportEmail, type OrderLine, type OrderView } from "../../lib/checkout";
import { cityLabel } from "../../lib/cities";
import { formatMoney } from "../../lib/money";
import { formatDeliveryDate } from "../../lib/rental-plan";
import { ProductImage } from "../product-image";

const eyebrow = "font-mono text-[10px] tracking-[0.12em] uppercase";

interface OrderSummaryProps {
  /** The cart about to be ordered, or the order already placed. */
  order: OrderView;
  /** The form the pay button submits. */
  formId: string;
  /** The order's number once placed, so a retry can say it is saved. */
  placedNumber: string | undefined;
  isSubmitting: boolean;
  error: CheckoutError | null;
}

// "for 3 more weeks", or "until you end the rental" for an open-ended one.
export function laterWeeksNote(weeks: number | null, weekly: string): string {
  if (weeks === 1) return "One week, charged today.";
  if (weeks === null) return `First week, charged today. Then ${weekly} / week until you end it.`;

  const more = weeks - 1;
  return `First week, charged today. Then ${weekly} / week for ${more} more ${more === 1 ? "week" : "weeks"}.`;
}

/** What the visitor is renting, what it costs today and every week, and the pay button. */
export function OrderSummary({
  order,
  formId,
  placedNumber,
  isSubmitting,
  error,
}: OrderSummaryProps) {
  const { summary, currency } = order;
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <aside aria-labelledby="order-summary-title" className="flex flex-col gap-6 lg:sticky lg:top-8">
      <div className="flex flex-col rounded-xl bg-fog p-6">
        <OrderDetails order={order} titleId="order-summary-title" />

        <Separator className="my-5" />

        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px]">Due today</p>
          <p className="font-mono text-[22px] leading-none tracking-[-0.02em]">
            {money(summary.totalDueToday)}
          </p>
        </div>
        <p className="pt-2 text-[10px] text-muted-foreground">
          {laterWeeksNote(order.weeks, money(summary.weeklySubtotal))}
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-5">
            <RiErrorWarningLine />
            <AlertTitle>
              {error.step === "pay" ? "PayPal didn't open" : "Your order wasn't placed"}
            </AlertTitle>
            <AlertDescription>
              {error.step === "pay" && placedNumber
                ? `Order ${placedNumber} is saved and nothing was charged. ${error.message}`
                : error.message}
            </AlertDescription>
          </Alert>
        ) : (
          placedNumber && (
            <Alert className="mt-5">
              <RiInformationLine />
              <AlertTitle>Order {placedNumber} is waiting for payment</AlertTitle>
              <AlertDescription>
                Nothing has been charged yet. To change it, email {supportEmail}.
              </AlertDescription>
            </Alert>
          )
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
              : error?.step === "pay"
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

      <SupportContact />
    </aside>
  );
}

interface OrderDetailsProps {
  order: OrderView;
  /** The id of the card's heading, for the landmark it sits in to point at. */
  titleId: string;
  /** The card's heading. */
  title?: string;
}

/** The top of an order card: where and when it arrives, what is in it and what each part costs. */
export function OrderDetails({ order, titleId, title = "Your order" }: OrderDetailsProps) {
  const { locations } = useRentalPlan();
  // A placed order keeps its own city and day, whatever the plan says now.
  const location = locations.find((candidate) => candidate.id === order.locationId);
  const { summary, currency, lines, leftOut: left } = order;
  const money = (amount: number) => formatMoney(amount, currency);

  const units = lines.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className={eyebrow}>
          {title}
        </h2>
        <p className={cn(eyebrow, "text-muted-foreground")}>
          {units === 1 ? "1 item" : `${units} items`}
        </p>
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-signal" />
        {[location && cityLabel(location), formatDeliveryDate(order.deliveryDate)]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <ul className="mt-5 flex flex-col">
        {lines.map((item) => (
          <SummaryLine
            key={item.productId}
            item={item}
            currency={currency}
            locationId={order.locationId}
          />
        ))}
      </ul>
      {left > 0 && (
        <p className="pt-3 text-[11px] text-muted-foreground">
          {left === 1 ? "1 item" : `${left} items`} in your cart {left === 1 ? "isn't" : "aren't"}{" "}
          available{location ? ` in ${location.name}` : ""} right now and won't be included.
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
    </>
  );
}

/** Where to reach a person, under an order card. */
export function SupportContact() {
  return (
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
  );
}

interface SummaryLineProps {
  item: OrderLine;
  currency: string;
  locationId: string;
}

function SummaryLine({ item, currency, locationId }: SummaryLineProps) {
  // Order lines carry no spec line; the city's catalog overview has one per product.
  const { data: overview } = useQuery(catalogOverviewQueryOptions(locationId));
  const spec = overview?.productSummaries[item.productId];

  return (
    <li className="flex items-center gap-4 border-b py-3.5 first:border-t">
      <ProductImage
        image={item.image}
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
