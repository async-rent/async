import { maxFailedBillingAttempts } from "@async-rent/core";
import { Separator } from "@async-rent/ui/components/separator";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { RiArrowLeftSLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { supportEmail } from "../../lib/checkout";
import { formatMoney } from "../../lib/money";
import { formatDeliveryDate } from "../../lib/rental-plan";
import { formatDay, type RentalDetail } from "../../lib/rentals";
import { OrderDetails, SupportContact, laterWeeksNote } from "../checkout/order-summary";
import { PayWithPayPal } from "../checkout/payment-return";
import { PaymentStatusBadge, RentalStatusBadge } from "./rental-status";

export const rentalPageClass =
  "mx-auto flex w-full max-w-360 flex-col px-5 pt-8 pb-20 md:px-10 xl:px-20";
const columnsClass =
  "grid gap-12 pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-20";
const headingClass =
  "font-heading text-[40px] leading-none font-normal tracking-[-0.02em] text-balance sm:text-[44px]";
const sectionHeadingClass = "font-heading text-2xl font-normal tracking-[-0.01em]";

/** The way back to the list, above a rental's page. */
export function AllRentalsLink() {
  return (
    <Link
      to="/rentals"
      className="group flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <RiArrowLeftSLine
        aria-hidden
        className="size-4 transition-transform duration-200 motion-safe:group-hover:-translate-x-0.5"
      />
      My rentals
    </Link>
  );
}

function addressOf(rental: RentalDetail): string {
  const { line1, line2, area, city, postcode } = rental.address;
  return [line1, line2, area, city, postcode].filter(Boolean).join(", ");
}

/** The headline and its sentence, from where the rental stands. */
function standing(rental: RentalDetail): { title: string; text: string } {
  const address = addressOf(rental);

  switch (rental.status) {
    case "pending_payment":
      return {
        title: "This rental isn't paid yet.",
        text: "Nothing has been charged. Pay the first week with PayPal to confirm it and book the delivery.",
      };
    case "confirmed":
    case "active":
      return rental.status === "active" || rental.delivered
        ? { title: "Your gear is set up.", text: `It was delivered to ${address}.` }
        : {
            title: `Arriving ${formatDeliveryDate(rental.deliveryDate)}.`,
            text: `It's paid and confirmed. We'll deliver and set up your gear at ${address}.`,
          };
    case "completed":
      return {
        title: "This rental is complete.",
        text: "Your gear was collected, and nothing more is charged.",
      };
    case "cancelled":
      return {
        title: "This rental was cancelled.",
        text: rental.cancelledAt
          ? `It was cancelled on ${formatDay(rental.cancelledAt)}. Nothing more is charged.`
          : "Nothing more is charged.",
      };
  }
}

/** Where the Billing plan stands, in a sentence. */
function billingNote(rental: RentalDetail): string {
  const weekly = formatMoney(rental.summary.weeklySubtotal, rental.currency);
  const plan = rental.billingPlan;

  if (rental.status === "pending_payment") {
    return "Weekly billing starts once the first week is paid.";
  }
  if (!plan) return "This rental has no weekly billing.";

  switch (plan.status) {
    case "active":
      if (!rental.nextChargeDate) return "Every week of this rental is paid.";
      return `${weekly} goes on your saved PayPal account on ${formatDeliveryDate(rental.nextChargeDate)}, then every week ${rental.weeks === null ? "until you end the rental" : "until its last week"}.`;
    case "paused":
      return plan.failedAttempts >= maxFailedBillingAttempts
        ? `Weekly billing is paused after ${plan.failedAttempts} declined charges. Email ${supportEmail} and we'll sort it out.`
        : `Weekly billing is paused while PayPal checks a charge. Email ${supportEmail} if you have questions.`;
    case "cancelled":
      return "Weekly billing has stopped.";
    case "completed":
      return "Weekly billing has finished.";
  }
}

function lengthLabel(rental: RentalDetail): string {
  if (rental.weeks === null) return "Until you end it";
  const weeks = rental.weeks === 1 ? "1 week" : `${rental.weeks} weeks`;
  return rental.endDate ? `${weeks}, to ${formatDeliveryDate(rental.endDate)}` : weeks;
}

/** One of the customer's rentals: where it stands, its delivery, payments and Billing plan. */
export function RentalOverview({ rental }: { rental: RentalDetail }) {
  const { title, text } = standing(rental);
  const money = (amount: number) => formatMoney(amount, rental.currency);

  return (
    <div className={rentalPageClass}>
      <AllRentalsLink />
      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-12">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-[13px] tracking-[0.02em]">{rental.number}</p>
              <RentalStatusBadge status={rental.status} />
            </div>
            <h1 className={headingClass}>{title}</h1>
            <p className="max-w-120 text-sm leading-normal text-muted-foreground">{text}</p>
          </div>

          {rental.status === "pending_payment" && (
            <div className="flex max-w-120 flex-col gap-4">
              <PayWithPayPal
                number={rental.number}
                label={`Pay ${money(rental.summary.totalDueToday)} with PayPal`}
              />
            </div>
          )}

          <DetailSection id="delivery-title" title="Delivery">
            <DetailRow label="Day">
              {formatDeliveryDate(rental.deliveryDate)}
              {rental.deliveryWindow &&
                `, ${rental.deliveryWindow.start}–${rental.deliveryWindow.end}`}
            </DetailRow>
            <DetailRow label="Address">{addressOf(rental)}</DetailRow>
            {rental.address.deliveryNotes && (
              <DetailRow label="Notes">{rental.address.deliveryNotes}</DetailRow>
            )}
            <DetailRow label="Contact">
              {[rental.contact.name, rental.contact.email, rental.contact.whatsapp]
                .filter(Boolean)
                .join(" · ")}
            </DetailRow>
          </DetailSection>

          <section aria-labelledby="payments-title" className="flex flex-col gap-4">
            <h2 id="payments-title" className={sectionHeadingClass}>
              Payments
            </h2>
            {rental.payments.length > 0 ? (
              <ol className="flex flex-col border-t">
                {rental.payments.map((payment) => (
                  <li
                    key={`${payment.billingCycle}-${payment.at}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b py-3.5 text-sm sm:grid-cols-[minmax(0,1fr)_110px_90px]"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p>Week {payment.billingCycle}</p>
                      <p className="text-xs text-muted-foreground">{formatDay(payment.at)}</p>
                    </div>
                    <div className="row-span-2 justify-self-end sm:row-span-1 sm:justify-self-start">
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <p className="font-mono sm:text-right">{money(payment.amount)}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">Nothing paid yet.</p>
            )}
          </section>

          <DetailSection id="billing-title" title="Billing plan" note={billingNote(rental)}>
            <DetailRow label="Every week" mono>
              {money(rental.summary.weeklySubtotal)}
            </DetailRow>
            <DetailRow label="Length">{lengthLabel(rental)}</DetailRow>
            <DetailRow label="Weeks paid" mono>
              {rental.weeksPaid}
            </DetailRow>
            <DetailRow label="Next charge">
              {rental.nextChargeDate ? formatDeliveryDate(rental.nextChargeDate) : "None"}
            </DetailRow>
          </DetailSection>
        </div>

        <aside
          aria-labelledby="rental-gear-title"
          className="flex flex-col gap-6 lg:sticky lg:top-8"
        >
          <div className="flex flex-col rounded-xl bg-fog p-6">
            <OrderDetails
              order={{ ...rental, leftOut: 0 }}
              titleId="rental-gear-title"
              title="Gear"
            />
            <Separator className="my-5" />
            {rental.status === "pending_payment" ? (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[13px]">Due now</p>
                  <p className="font-mono text-[22px] leading-none tracking-[-0.02em]">
                    {money(rental.summary.totalDueToday)}
                  </p>
                </div>
                <p className="pt-2 text-[10px] text-muted-foreground">
                  {laterWeeksNote(rental.weeks, money(rental.summary.weeklySubtotal))}
                </p>
              </>
            ) : (
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[13px]">Placed</p>
                <p className="text-[13px]">{formatDay(rental.placedAt)}</p>
              </div>
            )}
          </div>
          <SupportContact />
        </aside>
      </div>
    </div>
  );
}

interface DetailSectionProps {
  id: string;
  title: string;
  /** A sentence under the heading. */
  note?: string;
  children: ReactNode;
}

function DetailSection({ id, title, note, children }: DetailSectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id={id} className={sectionHeadingClass}>
          {title}
        </h2>
        {note && <p className="max-w-140 text-sm leading-normal text-muted-foreground">{note}</p>}
      </div>
      <dl className="flex flex-col border-t">{children}</dl>
    </section>
  );
}

interface DetailRowProps {
  label: string;
  mono?: boolean;
  children: ReactNode;
}

function DetailRow({ label, mono, children }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 border-b py-3.5 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono break-words" : "break-words"}>{children}</dd>
    </div>
  );
}

/** While the rental loads: the page's shape, empty. */
export function RentalSkeleton() {
  return (
    <div className={rentalPageClass} aria-busy="true" aria-label="Loading your rental">
      <Skeleton className="h-4 w-24" />
      <div className={columnsClass}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-11 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="mt-8 h-60 w-full" />
        </div>
        <Skeleton className="h-130 rounded-xl" />
      </div>
    </div>
  );
}
