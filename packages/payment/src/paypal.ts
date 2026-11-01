import {
  attempt,
  captureProviderOrderInputSchema,
  captureProviderOrderResult,
  createProviderOrderInputSchema,
  createProviderOrderResult,
  createResult,
  getProviderOrderInputSchema,
  getProviderOrderResult,
  refundProviderPaymentInputSchema,
  refundProviderPaymentResult,
} from "@async-rent/core";
import type {
  CaptureProviderOrderInput,
  CaptureProviderOrderResult,
  CreateProviderOrderInput,
  CreateProviderOrderResult,
  GetProviderOrderInput,
  GetProviderOrderResult,
  PaymentProviderAdapter,
  ProviderErrorCode,
  RefundProviderPaymentInput,
  RefundProviderPaymentResult,
} from "@async-rent/core";
import { z } from "zod";

/** Which PayPal to talk to: `sandbox` is PayPal's test environment. */
export type PayPalEnvironment = "sandbox" | "live";

/** Sends one HTTP request. Matches the global `fetch`; tests pass a stub. */
export type PayPalFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CreatePayPalAdapterOptions {
  /** Client id of the PayPal REST app. Read it from a Worker secret, never from code. */
  clientId: string;
  /** Secret of the PayPal REST app. Read it from a Worker secret, never from code. */
  clientSecret: string;
  /** Defaults to `sandbox`, so nothing moves real money until a deployment opts in. */
  environment?: PayPalEnvironment;
  /** Defaults to the global `fetch`. */
  fetch?: PayPalFetch;
}

/**
 * What PayPal said when it refused a request: the HTTP status plus the first
 * issue it listed. It is the `cause` of every `provider_refused` failure, so
 * the payment service keeps it for logs. `debugId` is what PayPal support
 * asks for.
 */
export interface PayPalFailure {
  status: number;
  issue?: string;
  description?: string;
  debugId?: string;
}

const baseUrls: Record<PayPalEnvironment, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

// Capture refusals that mean "this customer cannot pay this order", which the
// payment service records as a failed charge the customer can retry. Any other
// refusal is our or PayPal's fault and fails the call instead.
const declineReasons = new Map<string, string>([
  ["INSTRUMENT_DECLINED", "The payment method was declined. Try another one."],
  ["REDIRECT_PAYER_FOR_ALTERNATE_FUNDING", "The payment method was declined. Try another one."],
  ["PAYER_ACTION_REQUIRED", "PayPal needs the customer to approve the payment again."],
  ["ORDER_NOT_APPROVED", "The customer has not approved the payment at PayPal."],
  ["PAYER_CANNOT_PAY", "The customer cannot pay for this order with PayPal."],
  ["PAYER_ACCOUNT_RESTRICTED", "The customer's PayPal account is restricted."],
  ["PAYER_ACCOUNT_LOCKED_OR_CLOSED", "The customer's PayPal account is locked or closed."],
  ["TRANSACTION_REFUSED", "PayPal refused the transaction."],
  ["MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED", "Too many payment attempts. Try again later."],
]);

// The currencies PayPal accepts, by their ISO 4217 minor-unit digits. Spelled
// out rather than read from `Intl`, which follows CLDR (0 digits for HUF) and
// would shift amounts by a factor of 100.
const centCurrencies = [
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "CZK",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "SEK",
  "SGD",
  "THB",
  "TWD",
  "USD",
];
const currencyDigits = new Map<string, number>([
  ...centCurrencies.map((code) => [code, 2] as const),
  ["JPY", 0],
]);

// PayPal rejects decimals for these, even though ISO 4217 gives them cents.
const wholeUnitCurrencies = new Set(["HUF", "TWD"]);

const payPalAmountResult = createResult(
  z.object({ currency_code: z.string(), value: z.string() }),
  z.enum(["invalid_request"]),
);

type PayPalAmountResult = z.infer<typeof payPalAmountResult.schema>;

const tokenSchema = z.object({ access_token: z.string() });

const createdOrderSchema = z.object({
  id: z.string(),
  links: z.array(z.object({ href: z.url(), rel: z.string() })).default([]),
});

const statusDetailsSchema = z.object({ reason: z.string() }).optional();

const captureSchema = z.object({
  id: z.string(),
  status: z.string(),
  status_details: statusDetailsSchema,
});

type Capture = z.infer<typeof captureSchema>;

const orderSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  purchase_units: z
    .array(
      z.object({
        payments: z.object({ captures: z.array(captureSchema).default([]) }).optional(),
      }),
    )
    .default([]),
});

const refundSchema = z.object({
  id: z.string(),
  status: z.string(),
  status_details: statusDetailsSchema,
});

type Refund = z.infer<typeof refundSchema>;

// Covers both shapes PayPal errors come in: REST (`name`, `details`) and
// OAuth (`error`, `error_description`).
const errorBodySchema = z
  .object({
    name: z.string().optional(),
    message: z.string().optional(),
    debug_id: z.string().optional(),
    details: z
      .array(z.object({ issue: z.string().optional(), description: z.string().optional() }))
      .optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  })
  .catch({});

/** How one round trip to PayPal ended. Only `answered` carries a body to read. */
type PayPalReply =
  | { kind: "answered"; body: unknown }
  /** PayPal answered with an error status. `step` names the request when it is not the main one. */
  | { kind: "refused"; failure: PayPalFailure; step?: string }
  | { kind: "unreachable"; cause: unknown }
  | { kind: "unexpected"; cause: unknown };

type FailedReply = Exclude<PayPalReply, { kind: "answered" }>;

interface CallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** PayPal's idempotency key: a repeat with the same key returns the first reply. */
  requestId?: string;
}

/**
 * The PayPal adapter for the payment service, built on the Orders v2 and
 * Payments v2 REST APIs over `fetch`, so it runs in a Worker with no SDK.
 *
 * ```ts
 * const paypal = createPayPalAdapter({
 *   clientId: env.PAYPAL_CLIENT_ID,
 *   clientSecret: env.PAYPAL_CLIENT_SECRET,
 * });
 * const async = createAsync({ db, paymentProviders: { paypal } });
 * ```
 *
 * Every method returns a result and never throws. Capture and refund send an
 * idempotency key derived from the PayPal id, so a retried confirm or refund
 * replays PayPal's first answer instead of moving money twice. A capture or
 * refund that comes back pending is read again by its id, so a later call sees
 * it settle, and a capture retried after PayPal forgot the key reads the order
 * instead. Every call fetches a fresh access token; nothing is cached.
 */
export function createPayPalAdapter(options: CreatePayPalAdapterOptions): PaymentProviderAdapter {
  const baseUrl = baseUrls[options.environment ?? "sandbox"];
  const send = options.fetch ?? globalFetch;
  const credentials = toBasicCredentials(options.clientId, options.clientSecret);

  async function request(url: string, init: RequestInit): Promise<PayPalReply> {
    // Called inside `then` so a `fetch` that throws synchronously still lands in `attempt`.
    const sent = await attempt(Promise.resolve().then(() => send(url, init)));
    if (!sent.ok) return { kind: "unreachable", cause: sent.error };

    // An empty or non-JSON body reads as `undefined`; the schemas decide if that is fine.
    const read = await attempt<unknown>(sent.value.json());
    const body = read.ok ? read.value : undefined;
    if (sent.value.ok) return { kind: "answered", body };

    return { kind: "refused", failure: toFailure(sent.value.status, body) };
  }

  async function call(
    path: string,
    { method = "POST", body, requestId }: CallOptions = {},
  ): Promise<PayPalReply> {
    const token = await request(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (token.kind === "refused") return { ...token, step: "sign in" };
    if (token.kind !== "answered") return token;

    const parsed = tokenSchema.safeParse(token.body);
    if (!parsed.success) return { kind: "unexpected", cause: parsed.error };

    return request(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${parsed.data.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function createOrder(input: CreateProviderOrderInput): Promise<CreateProviderOrderResult> {
    const { ok, err } = createProviderOrderResult;

    const order = createProviderOrderInputSchema.safeParse(input);
    if (!order.success) return err("invalid_request", "Invalid PayPal order", order.error);

    const amount = toPayPalAmount(order.data.amount, order.data.currency);
    if (!amount.success) return amount;

    const reply = await call("/v2/checkout/orders", { body: toOrderBody(order.data, amount.data) });
    if (reply.kind !== "answered") return err(...toReplyError("create the order", reply));

    const created = createdOrderSchema.safeParse(reply.body);
    if (!created.success) {
      return err("provider_response_invalid", "PayPal sent an unexpected order", created.error);
    }

    const { id, links } = created.data;
    const approval = links.find(({ rel }) => rel === "payer-action" || rel === "approve");
    if (!approval)
      return err("provider_response_invalid", `PayPal order ${id} has no approval link`);

    return ok({ externalOrderId: id, approvalUrl: approval.href });
  }

  async function captureOrder(
    input: CaptureProviderOrderInput,
  ): Promise<CaptureProviderOrderResult> {
    const { ok, err } = captureProviderOrderResult;

    const capture = captureProviderOrderInputSchema.safeParse(input);
    if (!capture.success) return err("invalid_request", "Invalid PayPal capture", capture.error);

    const { externalOrderId } = capture.data;
    const reply = await call(`/v2/checkout/orders/${encodeURIComponent(externalOrderId)}/capture`, {
      requestId: `capture-${externalOrderId}`,
    });

    // PayPal keeps idempotency keys for 6 hours, so a confirm retried after
    // that is refused instead of replayed. The order still holds the capture.
    const captureRefused = reply.kind === "refused" && !reply.step;
    if (captureRefused && reply.failure.issue === "ORDER_ALREADY_CAPTURED") {
      const order = await readOrder(externalOrderId);
      if (!order.success) return order;
      if (order.data.status === "open") {
        return err("provider_response_invalid", `PayPal order ${externalOrderId} has no capture`);
      }

      return ok(order.data);
    }

    // Only the capture itself can decline; a failed sign-in is never the customer's to fix.
    const declined = captureRefused ? toDeclineReason(reply.failure) : undefined;
    if (declined) return ok({ status: "failed", failureReason: declined });
    if (reply.kind !== "answered") return err(...toReplyError("capture the order", reply));

    const order = orderSchema.safeParse(reply.body);
    if (!order.success) {
      return err("provider_response_invalid", "PayPal sent an unexpected capture", order.error);
    }

    const first = toFirstCapture(order.data);
    if (!first)
      return err("provider_response_invalid", `PayPal order ${order.data.id} has no capture`);

    return toCaptureResult(await readLatestCapture(first));
  }

  async function getOrder(input: GetProviderOrderInput): Promise<GetProviderOrderResult> {
    const { err } = getProviderOrderResult;

    const lookup = getProviderOrderInputSchema.safeParse(input);
    if (!lookup.success) return err("invalid_request", "Invalid PayPal order", lookup.error);

    return readOrder(lookup.data.externalOrderId);
  }

  /**
   * Where an order stands at PayPal: open until it has a capture, then that
   * capture's outcome, with a pending capture read fresh.
   */
  async function readOrder(externalOrderId: string): Promise<GetProviderOrderResult> {
    const { ok, err } = getProviderOrderResult;

    const reply = await call(`/v2/checkout/orders/${encodeURIComponent(externalOrderId)}`, {
      method: "GET",
    });
    // PayPal drops an order that expired before anyone captured it.
    if (reply.kind === "refused" && !reply.step && reply.failure.status === 404) {
      return ok({ status: "open" });
    }
    if (reply.kind !== "answered") return err(...toReplyError("read the order", reply));

    const order = orderSchema.safeParse(reply.body);
    if (!order.success) {
      return err("provider_response_invalid", "PayPal sent an unexpected order", order.error);
    }

    const first = toFirstCapture(order.data);
    if (first) return toCaptureResult(await readLatestCapture(first));
    // A completed order always carries its capture, so one without is not a shape we know.
    if (order.data.status === "COMPLETED") {
      return err("provider_response_invalid", `PayPal order ${order.data.id} has no capture`);
    }

    return ok({ status: "open" });
  }

  /**
   * A pending capture read straight from PayPal, so a retried confirm sees it
   * settle whatever the idempotent capture replays. Any capture that is not
   * pending, or a read that fails, keeps what the capture call said.
   */
  async function readLatestCapture(capture: Capture): Promise<Capture> {
    if (capture.status !== "PENDING") return capture;

    const reply = await call(`/v2/payments/captures/${encodeURIComponent(capture.id)}`, {
      method: "GET",
    });
    if (reply.kind !== "answered") return capture;

    const latest = captureSchema.safeParse(reply.body);

    return latest.success && latest.data.id === capture.id ? latest.data : capture;
  }

  async function refund(input: RefundProviderPaymentInput): Promise<RefundProviderPaymentResult> {
    const { ok, err } = refundProviderPaymentResult;

    const parsed = refundProviderPaymentInputSchema.safeParse(input);
    if (!parsed.success) return err("invalid_request", "Invalid PayPal refund", parsed.error);

    const { externalPaymentId, amount, currency } = parsed.data;
    const value = toPayPalAmount(amount, currency);
    if (!value.success) return value;

    const reply = await call(
      `/v2/payments/captures/${encodeURIComponent(externalPaymentId)}/refund`,
      {
        body: { amount: value.data },
        requestId: `refund-${externalPaymentId}`,
      },
    );
    // Already refunded in full is the state we asked for.
    if (reply.kind === "refused" && reply.failure.issue === "CAPTURE_FULLY_REFUNDED") return ok();
    if (reply.kind !== "answered") return err(...toReplyError("refund the payment", reply));

    const refunded = refundSchema.safeParse(reply.body);
    if (!refunded.success) {
      return err("provider_response_invalid", "PayPal sent an unexpected refund", refunded.error);
    }

    const latest = await readLatestRefund(refunded.data);
    const { id, status } = latest;
    if (status === "COMPLETED") return ok();

    const reason = toReasonSuffix(latest.status_details);
    // A pending refund can still fail (e.g. too little balance), so it is not
    // done yet. A retry replays this refund and reads it again.
    if (status === "PENDING")
      return err("payment_pending", `PayPal refund ${id} is PENDING${reason}`);

    return err("provider_refused", `PayPal refund ${id} is ${status}${reason}`, latest);
  }

  /** A pending refund read straight from PayPal; otherwise what the refund call said. */
  async function readLatestRefund(refund: Refund): Promise<Refund> {
    if (refund.status !== "PENDING") return refund;

    const reply = await call(`/v2/payments/refunds/${encodeURIComponent(refund.id)}`, {
      method: "GET",
    });
    if (reply.kind !== "answered") return refund;

    const latest = refundSchema.safeParse(reply.body);

    return latest.success && latest.data.id === refund.id ? latest.data : refund;
  }

  return { createOrder, captureOrder, getOrder, refund };
}

// Calls the global `fetch` unbound, which Workers require.
function globalFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

// HTTP Basic credentials, UTF-8 encoded first so `btoa` only ever sees bytes. Pure.
function toBasicCredentials(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);

  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

// Pure.
function toFailure(status: number, body: unknown): PayPalFailure {
  const error = errorBodySchema.parse(body);
  const [detail] = error.details ?? [];

  return {
    status,
    issue: detail?.issue ?? error.name ?? error.error,
    description: detail?.description ?? error.message ?? error.error_description,
    debugId: error.debug_id,
  };
}

// The `err` arguments for a reply that carries no usable body. Pure.
function toReplyError(
  action: string,
  reply: FailedReply,
): readonly [ProviderErrorCode, string, unknown] {
  if (reply.kind === "unreachable") {
    return ["provider_unreachable", "PayPal could not be reached", reply.cause];
  }
  if (reply.kind === "unexpected") {
    return ["provider_response_invalid", "PayPal sent an unexpected token", reply.cause];
  }

  const { status, issue, description, debugId } = reply.failure;
  const message = [
    `PayPal could not ${reply.step ?? action} [${status}${issue ? ` ${issue}` : ""}]`,
    description ? `: ${description}` : "",
    debugId ? ` (debug id ${debugId})` : "",
  ].join("");

  return ["provider_refused", message, reply.failure];
}

// The reason to show when a capture refusal is the customer's to fix. Pure.
function toDeclineReason(failure: PayPalFailure): string | undefined {
  if (failure.status !== 422 || !failure.issue) return undefined;

  return declineReasons.get(failure.issue);
}

// The order's capture; an Async order has one purchase unit and captures it once. Pure.
function toFirstCapture(order: z.infer<typeof orderSchema>): Capture | undefined {
  const [first] = order.purchase_units.flatMap((unit) => unit.payments?.captures ?? []);

  return first;
}

// Pure.
function toCaptureResult(capture: Capture): CaptureProviderOrderResult {
  const { ok, err } = captureProviderOrderResult;

  const reason = toReasonSuffix(capture.status_details);
  // A partial refund made at PayPal leaves the rest of the money taken.
  if (capture.status === "COMPLETED" || capture.status === "PARTIALLY_REFUNDED") {
    return ok({ status: "succeeded", externalPaymentId: capture.id });
  }
  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    return ok({ status: "failed", failureReason: `PayPal declined the payment${reason}.` });
  }
  // Refunded in full at PayPal, so no money is held and the customer can pay again.
  if (capture.status === "REFUNDED") {
    return ok({ status: "failed", failureReason: "PayPal refunded the payment." });
  }
  // PENDING (held for review, or an eCheck clearing) has not moved the money
  // yet, so it is neither outcome. Failing the call leaves the payment pending.
  if (capture.status === "PENDING") {
    return err("payment_pending", `PayPal capture ${capture.id} is PENDING${reason}`);
  }

  // Any other status is not one PayPal documents. Reading it as pending would
  // block the payment for good, so it fails as a reply we do not understand.
  return err(
    "provider_response_invalid",
    `PayPal capture ${capture.id} is ${capture.status}${reason}`,
  );
}

// Pure.
function toReasonSuffix(details: { reason: string } | undefined): string {
  return details ? ` (${details.reason})` : "";
}

// Pure.
function toOrderBody(
  order: CreateProviderOrderInput,
  amount: { currency_code: string; value: string },
) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.reference,
        description: `Async rental ${order.reference}`,
        amount,
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Async",
          // We deliver to the address on the rental, not to one PayPal collects.
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: order.returnUrl,
          cancel_url: order.cancelUrl,
        },
      },
    },
  };
}

/**
 * PayPal's amount for an integer in the currency's minor unit, e.g. 37000 USD
 * is `{ currency_code: "USD", value: "370.00" }`. Built from the digits rather
 * than by division, so no float rounding can creep in. Pure.
 */
function toPayPalAmount(amount: number, currency: string): PayPalAmountResult {
  const { ok, err } = payPalAmountResult;

  const digits = currencyDigits.get(currency);
  if (digits === undefined) return err("invalid_request", `PayPal does not accept ${currency}`);
  // PayPal refuses a zero charge or refund, so say so before asking it.
  if (amount <= 0)
    return err("invalid_request", `PayPal needs an amount above zero, got ${amount}`);

  const minor = String(amount).padStart(digits + 1, "0");
  const whole = digits === 0 ? minor : minor.slice(0, -digits);
  const fraction = digits === 0 ? "" : minor.slice(-digits);

  if (!wholeUnitCurrencies.has(currency)) {
    return ok({ currency_code: currency, value: fraction ? `${whole}.${fraction}` : whole });
  }
  if (/[^0]/.test(fraction)) {
    return err(
      "invalid_request",
      `PayPal only takes whole ${currency} amounts, got ${amount} minor units`,
    );
  }

  return ok({ currency_code: currency, value: whole });
}
