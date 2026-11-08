import { Button } from "@async-rent/ui/components/button";
import { Spinner } from "@async-rent/ui/components/spinner";
import type { App } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  RiCheckboxCircleFill,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiTimeLine,
} from "@remixicon/react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import type { CustomerPayment } from "../../shared/payments";
import type { ConfirmPaymentOutput } from "../../tools/confirm-payment";
import type { StartPaymentInput, StartPaymentOutput } from "../../tools/start-payment";
import { formatMoney } from "../shared/money";
import {
  errorCode,
  errorMessage,
  structuredResult,
  useHostedWidget,
} from "../shared/use-hosted-widget";

/** How often the checkout asks whether the customer approved, once PayPal is open. */
const watchInterval = 5_000;

/** How long it keeps asking before leaving it to the I've approved button. */
const watchWindow = 5 * 60_000;

// confirm_payment failures a later check can clear: no approval yet, money on
// hold, or PayPal unreachable. The rest need the assistant.
const retryableCodes: ReadonlySet<string> = new Set([
  "payment_not_approved",
  "payment_pending",
  "provider_request_failed",
]);

/**
 * The start_payment result as a PayPal checkout: the total due today, a Pay with
 * PayPal button that opens the approval page through the host, and an I've
 * approved button that confirms the payment. Once PayPal is open it also checks
 * for the approval on its own for a few minutes. The outcome goes to the
 * assistant as model context. A fresh link is the assistant's to fetch, so the
 * checkout never asks for one.
 */
export function PayPalCheckout() {
  const { app, error, toolInput, toolResult } = useHostedWidget("PayPal checkout");

  if (error) return <Notice>Couldn't connect to the chat. {error.message}</Notice>;
  if (!app || !toolResult) {
    return (
      <Notice>
        <Spinner /> Preparing your checkout…
      </Notice>
    );
  }

  const failure = errorMessage(toolResult);
  if (failure) return <Notice>{failure}</Notice>;

  const started = structuredResult<StartPaymentOutput>(toolResult);
  if (!started) return <Notice>This checkout can't be shown here.</Notice>;

  const number = rentalNumber(toolInput);
  if (started.status === "paid") return <Paid payment={started.payment} number={number} />;
  if (!started.approvalUrl) return <Notice>This checkout can't be shown here.</Notice>;

  // A new link is a new checkout, so it starts over.
  return (
    <Checkout
      key={started.approvalUrl}
      app={app}
      payment={started.payment}
      approvalUrl={started.approvalUrl}
      number={number}
    />
  );
}

function rentalNumber(input: Record<string, unknown> | undefined): string | undefined {
  const number: unknown = (input as Partial<StartPaymentInput> | undefined)?.number;
  return typeof number === "string" ? number : undefined;
}

/** What one confirm_payment call said about the payment. */
type Outcome =
  | { kind: "paid"; payment: CustomerPayment }
  | { kind: "declined"; reason: string }
  | { kind: "not_approved" }
  | { kind: "failed"; message: string; retryable: boolean };

type Check = { kind: "idle" } | { kind: "checking" } | Outcome;

interface CheckoutProps {
  app: App;
  payment: CustomerPayment;
  approvalUrl: string;
  number: string | undefined;
}

function Checkout({ app, payment, approvalUrl, number }: CheckoutProps) {
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  // Set while the checkout asks for the approval on its own.
  const [watchUntil, setWatchUntil] = useState<number>();
  const [linkBlocked, setLinkBlocked] = useState(false);

  // An outcome the customer can't change by checking again ends the watch and
  // reaches the assistant.
  function settle(outcome: Outcome) {
    setCheck(outcome);
    if (outcome.kind === "not_approved") return;
    if (outcome.kind === "failed" && outcome.retryable) return;

    setWatchUntil(undefined);
    if (number) void reportOutcome(app, number, outcome);
  }

  useEffect(() => {
    if (watchUntil === undefined || !number) return;

    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const outcome = await confirm(app, number);
      if (!current) return;

      const settled =
        outcome.kind === "paid" ||
        outcome.kind === "declined" ||
        (outcome.kind === "failed" && !outcome.retryable);
      if (settled) {
        setCheck(outcome);
        setWatchUntil(undefined);
        void reportOutcome(app, number, outcome);
        return;
      }
      if (Date.now() >= watchUntil) {
        // Leave it to the customer to say when they have approved.
        setCheck(outcome);
        setWatchUntil(undefined);
        return;
      }
      timer = setTimeout(tick, watchInterval);
    };
    timer = setTimeout(tick, watchInterval);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [app, number, watchUntil]);

  async function openPayPal() {
    setLinkBlocked(false);
    try {
      const { isError } = await app.openLink({ url: approvalUrl });
      if (isError) {
        setLinkBlocked(true);
        return;
      }
    } catch {
      setLinkBlocked(true);
      return;
    }
    setCheck({ kind: "idle" });
    setWatchUntil(Date.now() + watchWindow);
  }

  async function confirmApproval() {
    if (!number) return;

    setCheck({ kind: "checking" });
    settle(await confirm(app, number));
  }

  if (check.kind === "paid") return <Paid payment={check.payment} number={number} />;

  const watching = watchUntil !== undefined;
  const declined = check.kind === "declined";

  return (
    <main className="flex flex-col gap-4 p-4">
      <DueToday payment={payment} number={number} />

      <Status check={check} watching={watching} />

      {linkBlocked && (
        <p className="text-xs text-muted-foreground">
          Your chat didn't open PayPal. Open this link yourself to approve the payment:{" "}
          <span className="break-all text-foreground select-all">{approvalUrl}</span>
        </p>
      )}

      {!declined && (
        <footer className="flex flex-wrap gap-2">
          <Button onClick={openPayPal}>
            Pay with PayPal
            <RiExternalLinkLine data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            disabled={!number || check.kind === "checking"}
            onClick={confirmApproval}
          >
            {check.kind === "checking" && <Spinner data-icon="inline-start" />}
            I've approved
          </Button>
        </footer>
      )}
    </main>
  );
}

/** Asks confirm_payment whether the rental is paid. Never throws. */
async function confirm(app: App, number: string): Promise<Outcome> {
  let result: CallToolResult;
  try {
    result = await app.callServerTool({ name: "confirm_payment", arguments: { number } });
  } catch {
    return {
      kind: "failed",
      message: "Couldn't reach Async to confirm the payment. Try again in a moment.",
      retryable: true,
    };
  }

  const failure = errorMessage(result);
  if (failure !== undefined) {
    const code = errorCode(result);
    if (code === "payment_not_approved") return { kind: "not_approved" };

    // A host that drops the code leaves no way to tell, so checking again stays possible.
    return { kind: "failed", message: failure, retryable: !code || retryableCodes.has(code) };
  }

  const payment = structuredResult<ConfirmPaymentOutput>(result)?.payment;
  if (!payment) {
    return {
      kind: "failed",
      message: "Async sent an answer this checkout can't read.",
      retryable: true,
    };
  }

  switch (payment.status) {
    case "succeeded":
      return { kind: "paid", payment };
    case "failed":
      return { kind: "declined", reason: payment.failureReason ?? "PayPal declined the payment." };
    case "refunded":
      return { kind: "failed", message: "This payment was refunded.", retryable: false };
    default:
      return {
        kind: "failed",
        message: "PayPal is still processing the payment.",
        retryable: true,
      };
  }
}

/** Tells the assistant how the checkout ended, without adding a chat message. */
async function reportOutcome(app: App, number: string, outcome: Outcome): Promise<void> {
  try {
    await app.updateModelContext({
      content: [{ type: "text", text: outcomeText(number, outcome) }],
      structuredContent: { rental: number, checkout: outcome },
    });
  } catch {
    // The checkout still shows the outcome, and the customer can tell the assistant.
  }
}

function outcomeText(number: string, outcome: Outcome): string {
  switch (outcome.kind) {
    case "paid":
      return `The customer paid rental ${number} in the PayPal checkout: the rental is confirmed and weekly billing has started. There is no need to call confirm_payment.`;
    case "declined":
      return `PayPal declined the payment for rental ${number} in the checkout: ${outcome.reason} Call start_payment for a fresh link if the customer wants to try again.`;
    case "not_approved":
      return `The customer hasn't approved the payment for rental ${number} at PayPal yet.`;
    case "failed":
      return `Confirming the payment for rental ${number} in the PayPal checkout failed: ${outcome.message}`;
  }
}

interface DueTodayProps {
  payment: CustomerPayment;
  number: string | undefined;
}

function DueToday({ payment, number }: DueTodayProps) {
  return (
    <header className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">
        {number ? `Rental ${number} · ` : ""}Due today
      </p>
      <p className="text-2xl leading-8 font-semibold tabular-nums">
        {formatMoney(payment.amount, payment.currency)}
      </p>
      <p className="text-xs text-muted-foreground">First week, deposit and delivery</p>
    </header>
  );
}

interface StatusProps {
  check: Check;
  watching: boolean;
}

function Status({ check, watching }: StatusProps) {
  if (check.kind === "checking") {
    return <StatusLine icon={<Spinner />}>Checking with PayPal…</StatusLine>;
  }
  if (check.kind === "declined") {
    return (
      <StatusLine icon={<RiCloseCircleLine />} tone="destructive">
        {check.reason} Ask your assistant for a new PayPal link to try again.
      </StatusLine>
    );
  }
  if (check.kind === "not_approved") {
    return (
      <StatusLine icon={<RiTimeLine />} tone="warning">
        PayPal hasn't received your approval yet.{" "}
        {watching
          ? "This updates once you've approved."
          : "Approve the payment at PayPal, then press I've approved."}
      </StatusLine>
    );
  }
  // While watching, a check that may still clear stays quiet until the watch ends.
  if (check.kind === "failed" && (!watching || !check.retryable)) {
    return (
      <StatusLine icon={<RiErrorWarningLine />} tone="destructive">
        {check.message}
      </StatusLine>
    );
  }
  if (watching) {
    return (
      <StatusLine icon={<Spinner />}>
        Waiting for your approval at PayPal. This updates once you've approved.
      </StatusLine>
    );
  }

  return (
    <StatusLine>
      Press Pay with PayPal to approve the payment at PayPal. You won't be charged until you
      approve.
    </StatusLine>
  );
}

interface StatusLineProps {
  icon?: React.ReactNode;
  tone?: "muted" | "warning" | "destructive";
  children: React.ReactNode;
}

function StatusLine({ icon, tone = "muted", children }: StatusLineProps) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
        tone === "muted" && "text-muted-foreground",
        tone === "warning" && "text-foreground",
        tone === "destructive" && "text-destructive",
      )}
    >
      {icon}
      <span>{children}</span>
    </p>
  );
}

interface PaidProps {
  payment: CustomerPayment;
  number: string | undefined;
}

function Paid({ payment, number }: PaidProps) {
  return (
    <main className="flex flex-col items-start gap-2 p-4" role="status">
      <RiCheckboxCircleFill aria-hidden="true" className="size-8 text-primary" />
      <p className="text-base font-medium">Payment received</p>
      <p className="text-sm text-muted-foreground">
        {formatMoney(payment.amount, payment.currency)} paid
        {number ? ` for rental ${number}` : ""}. Your rental is confirmed, and later weeks are
        charged weekly to the same PayPal account.
      </p>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
      {children}
    </p>
  );
}
