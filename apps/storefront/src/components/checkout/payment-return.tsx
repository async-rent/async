import { Alert, AlertDescription, AlertTitle } from "@async-rent/ui/components/alert";
import { Button, buttonVariants } from "@async-rent/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@async-rent/ui/components/empty";
import { Separator } from "@async-rent/ui/components/separator";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { Spinner } from "@async-rent/ui/components/spinner";
import { SignInButton } from "@clerk/tanstack-react-start";
import {
  RiArrowRightLine,
  RiCalendarLine,
  RiErrorWarningLine,
  RiMailLine,
  RiTruckLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useCheckout } from "../../hooks/use-checkout";
import { supportEmail, type OpenOrder, type OrderView, type PaidOrder } from "../../lib/checkout";
import { formatMoney } from "../../lib/money";
import { formatDeliveryDate } from "../../lib/rental-plan";
import { CheckoutSteps } from "./checkout-steps";
import { OrderDetails, SupportContact, laterWeeksNote } from "./order-summary";

const pageClass = "mx-auto flex w-full max-w-360 flex-col px-5 pt-8 pb-20 md:px-10 xl:px-20";
const columnsClass =
  "grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-20";
const headingClass =
  "font-heading text-[40px] leading-none font-normal tracking-[-0.02em] text-balance sm:text-[44px]";

interface ReturnLayoutProps {
  step: "checkout" | "confirmed";
  title: ReactNode;
  description: ReactNode;
  /** What the visitor can do next, under the description. */
  actions?: ReactNode;
  children?: ReactNode;
  /** The order card beside the main column. */
  aside: ReactNode;
}

/** The pages PayPal returns to: checkout's steps, a headline with what to do next, and the order. */
function ReturnLayout({ step, title, description, actions, children, aside }: ReturnLayoutProps) {
  return (
    <div className={pageClass}>
      <CheckoutSteps current={step} />
      <div className={columnsClass}>
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-4" aria-live="polite">
            <h1 className={headingClass}>{title}</h1>
            <div className="flex max-w-120 flex-col gap-2 text-sm leading-normal text-muted-foreground">
              {description}
            </div>
          </div>
          {actions && <div className="flex max-w-120 flex-col gap-4">{actions}</div>}
          {children}
        </div>
        {aside}
      </div>
    </div>
  );
}

function OrderNumber({ number }: { number: string }) {
  return (
    <p className="text-foreground">
      Order <span className="font-mono text-[13px] tracking-[0.02em]">{number}</span>
    </p>
  );
}

interface OrderReceiptProps {
  order: OrderView;
  totalLabel: string;
  total: number;
  note: string;
}

/** The order as the summary showed it at checkout, without the pay button. */
function OrderReceipt({ order, totalLabel, total, note }: OrderReceiptProps) {
  return (
    <aside aria-labelledby="order-receipt-title" className="flex flex-col gap-6 lg:sticky lg:top-8">
      <div className="flex flex-col rounded-xl bg-fog p-6">
        <OrderDetails order={order} titleId="order-receipt-title" />
        <Separator className="my-5" />
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px]">{totalLabel}</p>
          <p className="font-mono text-[22px] leading-none tracking-[-0.02em]">
            {formatMoney(total, order.currency)}
          </p>
        </div>
        <p className="pt-2 text-[10px] text-muted-foreground">{note}</p>
      </div>
      <SupportContact />
    </aside>
  );
}

function EmailUs() {
  return (
    <a
      href={`mailto:${supportEmail}`}
      className={buttonVariants({ variant: "outline", size: "lg", className: "px-4" })}
    >
      Email us
    </a>
  );
}

interface PayWithPayPalProps {
  number: string;
  /** The button's label while it waits for a click. */
  label: string;
  /** More actions beside the button. */
  children?: ReactNode;
}

/** Opens PayPal for an order still waiting for its first payment, as checkout does. */
export function PayWithPayPal({ number, label, children }: PayWithPayPalProps) {
  const checkout = useCheckout(number);

  return (
    <>
      {checkout.error && (
        <Alert variant="destructive">
          <RiErrorWarningLine />
          <AlertTitle>PayPal didn't open</AlertTitle>
          <AlertDescription>Nothing was charged. {checkout.error.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          className="px-4"
          disabled={checkout.isSubmitting}
          onClick={() => checkout.submit(undefined)}
        >
          {checkout.isSubmitting && <Spinner data-icon="inline-start" />}
          {checkout.isSubmitting ? "Opening PayPal…" : label}
          {!checkout.isSubmitting && <RiArrowRightLine data-icon="inline-end" />}
        </Button>
        {children}
      </div>
    </>
  );
}

/** Reopens PayPal for an order still waiting for its first payment. */
function PaymentRetry({ number }: { number: string }) {
  return (
    <PayWithPayPal number={number} label="Try PayPal again">
      <EmailUs />
    </PayWithPayPal>
  );
}

const dueTodayNote = (order: OpenOrder) =>
  laterWeeksNote(order.weeks, formatMoney(order.summary.weeklySubtotal, order.currency));

interface UnpaidOrderProps {
  order: OpenOrder;
  title: string;
  /** Why the payment didn't happen, in the visitor's terms. */
  reason?: string;
}

/** An order whose payment was declined or cancelled: it is saved, nothing was charged, try again. */
export function UnpaidOrder({ order, title, reason }: UnpaidOrderProps) {
  return (
    <ReturnLayout
      step="checkout"
      title={title}
      description={
        <>
          {reason && <p className="text-foreground">{reason}</p>}
          <p>
            Nothing was charged. Order {order.number} is saved, so you can pay for it whenever
            you're ready.
          </p>
        </>
      }
      actions={<PaymentRetry number={order.number} />}
      aside={
        <OrderReceipt
          order={order}
          totalLabel="Due today"
          total={order.summary.totalDueToday}
          note={dueTodayNote(order)}
        />
      }
    />
  );
}

/** The weekly billing step: when the next week is charged, or that nothing more is. */
function billingStep(order: PaidOrder): { title: string; text: string } {
  const weekly = formatMoney(order.summary.weeklySubtotal, order.currency);

  if (!order.nextChargeDate) {
    return {
      title: "Nothing more to pay",
      text:
        order.weeks === 1
          ? "Your rental runs one week, and that week is paid."
          : "Every week of your rental is paid.",
    };
  }

  const more = order.chargesLeft;
  const until =
    more === null
      ? "every week until you end the rental"
      : more === 1
        ? "for its last week"
        : `for ${more} more weeks`;

  return {
    title: `Next charge on ${formatDeliveryDate(order.nextChargeDate)}`,
    text: `${weekly} a week, from the PayPal account you paid with, ${until}.`,
  };
}

// The local calendar day of a timestamp, to compare two of them. Pure.
const localDay = (date: Date) => date.toDateString();

/** The confirmation: the order is paid, and when it arrives and is billed next. */
export function PaidConfirmation({ order }: { order: PaidOrder }) {
  const delivery = formatDeliveryDate(order.deliveryDate);
  const { details } = order;
  const address = [details.line1, details.city].filter(Boolean).join(", ");
  const billing = billingStep(order);
  const deposit = order.summary.deposit;
  // Rendered in the browser only, once the confirm query answers, so "today" is the visitor's.
  const paidAt = new Date(order.paidAt);
  const paidToday = localDay(paidAt) === localDay(new Date());
  const paidLabel = paidToday
    ? "Paid today"
    : `Paid on ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(paidAt)}`;

  return (
    <ReturnLayout
      step="confirmed"
      title="You're all set."
      description={
        <>
          <OrderNumber number={order.number} />
          <p>
            {order.delivered
              ? `It's paid and confirmed, and your setup was delivered on ${delivery}.`
              : `It's paid and confirmed. We'll bring your setup on ${delivery}.`}
          </p>
        </>
      }
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            to="/rentals/$number"
            params={{ number: order.number }}
            className={buttonVariants({ size: "lg", className: "px-4" })}
          >
            See your rental
            <RiArrowRightLine data-icon="inline-end" />
          </Link>
          <Link
            to="/"
            className={buttonVariants({ variant: "outline", size: "lg", className: "px-4" })}
          >
            Back to the shop
          </Link>
        </div>
      }
      aside={
        <OrderReceipt
          order={order}
          totalLabel={paidLabel}
          total={order.paid}
          note={
            deposit > 0
              ? `Paid with PayPal. Includes a ${formatMoney(deposit, order.currency)} refundable deposit.`
              : "Paid with PayPal."
          }
        />
      }
    >
      <section aria-labelledby="next-steps-title" className="flex max-w-140 flex-col gap-4">
        <h2 id="next-steps-title" className="font-heading text-2xl font-normal tracking-[-0.01em]">
          What happens next
        </h2>
        <ol className="flex flex-col">
          {!order.delivered && (
            <NextStep icon={RiTruckLine} title={`Delivery on ${delivery}`}>
              We deliver, assemble and set up everything{address ? ` at ${address}` : ""}.{" "}
              {details.whatsapp
                ? `We'll WhatsApp ${details.whatsapp} before we arrive.`
                : `We'll email ${details.email} before we arrive.`}
            </NextStep>
          )}
          <NextStep icon={RiCalendarLine} title={billing.title}>
            {billing.text}
          </NextStep>
          <NextStep icon={RiMailLine} title="Changes or questions">
            Email{" "}
            <a
              href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Order ${order.number}`)}`}
              className="text-foreground underline underline-offset-3 hover:text-primary"
            >
              {supportEmail}
            </a>{" "}
            with your order number and we'll sort it out.
          </NextStep>
        </ol>
      </section>
    </ReturnLayout>
  );
}

interface NextStepProps {
  icon: RemixiconComponentType;
  title: string;
  children: ReactNode;
}

function NextStep({ icon: Icon, title, children }: NextStepProps) {
  return (
    <li className="flex gap-4 border-b py-4 first:border-t">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm leading-normal text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

/** While PayPal answers: the final layout, with the order card still to come. */
export function ConfirmingPayment() {
  return (
    <div className={pageClass} aria-busy="true">
      <CheckoutSteps current="checkout" />
      <div className={columnsClass}>
        <div className="flex flex-col gap-4" aria-live="polite">
          <h1 className={headingClass}>Confirming your payment…</h1>
          <p className="flex max-w-120 items-center gap-2 text-sm leading-normal text-muted-foreground">
            <Spinner />
            This takes a few seconds. Keep this page open.
          </p>
        </div>
        <Skeleton className="h-130 rounded-xl" />
      </div>
    </div>
  );
}

/** While the order loads. */
export function ReturnSkeleton() {
  return (
    <div className={pageClass} aria-busy="true" aria-label="Loading your order">
      <Skeleton className="h-4 w-48" />
      <div className={columnsClass}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="mt-6 h-10 w-44" />
        </div>
        <Skeleton className="h-130 rounded-xl" />
      </div>
    </div>
  );
}

interface ReturnMessageProps {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

/** A return with no order to show: a sentence on where things stand and the way on. */
export function ReturnMessage({ title, children, actions }: ReturnMessageProps) {
  return (
    <Empty className="min-h-120" aria-live="polite">
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={1} className="font-heading text-2xl font-normal">
          {title}
        </EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">{actions}</EmptyContent>
    </Empty>
  );
}

export function SignedOutReturn() {
  return (
    <ReturnMessage
      title="Sign in to see your order"
      actions={
        <SignInButton mode="modal">
          <Button>Sign in</Button>
        </SignInButton>
      }
    >
      Your order is saved to your account. Sign in with the account you checked out with.
    </ReturnMessage>
  );
}

export function NoOrderReturn() {
  return (
    <ReturnMessage
      title="There's no order to show"
      actions={
        <Link to="/checkout" className={buttonVariants({ variant: "outline" })}>
          Go to checkout
        </Link>
      }
    >
      This page shows your order once you've paid for it with PayPal.
    </ReturnMessage>
  );
}

interface ReturnErrorProps {
  title: string;
  error: Error;
  onRetry: () => void;
  isRetrying: boolean;
  /** A sentence that makes trying again safe to do. */
  reassurance?: string;
}

export function ReturnError({ title, error, onRetry, isRetrying, reassurance }: ReturnErrorProps) {
  return (
    <ReturnMessage
      title={title}
      actions={
        <>
          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying && <Spinner data-icon="inline-start" />}
            Try again
          </Button>
          <a href={`mailto:${supportEmail}`} className={buttonVariants({ variant: "outline" })}>
            Email us
          </a>
        </>
      }
    >
      {[error.message, reassurance].filter(Boolean).join(" ")}
    </ReturnMessage>
  );
}
