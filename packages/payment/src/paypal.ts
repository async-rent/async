import {
  captureProviderOrderInputSchema,
  createProviderOrderInputSchema,
  refundProviderPaymentInputSchema,
} from "@async-rent/core";
import type {
  CaptureOutcome,
  CaptureProviderOrderInput,
  CreateProviderOrderInput,
  PaymentProviderAdapter,
  RefundProviderPaymentInput,
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
 * issue it listed. Attached as the `cause` of every error the adapter throws,
 * so the payment service keeps it for logs. `debugId` is what PayPal support
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
// refusal is our or PayPal's fault and is thrown instead.
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

const tokenSchema = z.object({ access_token: z.string() });

const createdOrderSchema = z.object({
  id: z.string(),
  links: z.array(z.object({ href: z.url(), rel: z.string() })).default([]),
});

const statusDetailsSchema = z.object({ reason: z.string() }).optional();

const capturedOrderSchema = z.object({
  id: z.string(),
  purchase_units: z
    .array(
      z.object({
        payments: z
          .object({
            captures: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.string(),
                  status_details: statusDetailsSchema,
                }),
              )
              .default([]),
          })
          .optional(),
      }),
    )
    .default([]),
});

type CapturedOrder = z.infer<typeof capturedOrderSchema>;

const refundSchema = z.object({
  id: z.string(),
  status: z.string(),
  status_details: statusDetailsSchema,
});

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

type PayPalReply = { ok: true; body: unknown } | { ok: false; failure: PayPalFailure };

interface PostOptions {
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
 * Capture and refund send an idempotency key derived from the PayPal id, so a
 * retried confirm or refund replays PayPal's first answer instead of moving
 * money twice. Every call fetches a fresh access token; nothing is cached.
 */
export function createPayPalAdapter(options: CreatePayPalAdapterOptions): PaymentProviderAdapter {
  const baseUrl = baseUrls[options.environment ?? "sandbox"];
  const send = options.fetch ?? globalFetch;
  const credentials = btoa(`${options.clientId}:${options.clientSecret}`);

  async function request(url: string, init: RequestInit): Promise<PayPalReply> {
    const response = await send(url, init).catch((error: unknown) => {
      throw new Error("PayPal could not be reached", { cause: error });
    });
    const body = await readBody(response);
    if (response.ok) return { ok: true, body };

    return { ok: false, failure: toFailure(response.status, body) };
  }

  async function accessToken(): Promise<string> {
    const reply = await request(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!reply.ok) throw toError("sign in", reply.failure);

    return parseOrThrow(tokenSchema, reply.body, "PayPal sent an unexpected token").access_token;
  }

  async function post(path: string, { body, requestId }: PostOptions = {}): Promise<PayPalReply> {
    const token = await accessToken();

    return request(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function createOrder(input: CreateProviderOrderInput) {
    const order = parseOrThrow(createProviderOrderInputSchema, input, "Invalid PayPal order");

    const reply = await post("/v2/checkout/orders", { body: toOrderBody(order) });
    if (!reply.ok) throw toError("create the order", reply.failure);

    const created = parseOrThrow(createdOrderSchema, reply.body, "PayPal sent an unexpected order");
    const approval = created.links.find(({ rel }) => rel === "payer-action" || rel === "approve");
    if (!approval) throw new Error(`PayPal order ${created.id} has no approval link`);

    return { externalOrderId: created.id, approvalUrl: approval.href };
  }

  async function captureOrder(input: CaptureProviderOrderInput): Promise<CaptureOutcome> {
    const { externalOrderId } = parseOrThrow(
      captureProviderOrderInputSchema,
      input,
      "Invalid PayPal capture",
    );

    const id = encodeURIComponent(externalOrderId);
    const reply = await post(`/v2/checkout/orders/${id}/capture`, {
      requestId: `capture-${externalOrderId}`,
    });
    if (!reply.ok) return toDeclined(reply.failure);

    return toCaptureOutcome(
      parseOrThrow(capturedOrderSchema, reply.body, "PayPal sent an unexpected capture"),
    );
  }

  async function refund(input: RefundProviderPaymentInput): Promise<void> {
    const { externalPaymentId, amount, currency } = parseOrThrow(
      refundProviderPaymentInputSchema,
      input,
      "Invalid PayPal refund",
    );

    const id = encodeURIComponent(externalPaymentId);
    const reply = await post(`/v2/payments/captures/${id}/refund`, {
      body: { amount: toPayPalAmount(amount, currency) },
      requestId: `refund-${externalPaymentId}`,
    });
    // Already refunded in full is the state we asked for.
    if (!reply.ok && reply.failure.issue === "CAPTURE_FULLY_REFUNDED") return;
    if (!reply.ok) throw toError("refund the payment", reply.failure);

    const refunded = parseOrThrow(refundSchema, reply.body, "PayPal sent an unexpected refund");
    // A pending refund is accepted by PayPal and settles on its side.
    if (refunded.status === "COMPLETED" || refunded.status === "PENDING") return;

    throw new Error(
      `PayPal refund ${refunded.id} is ${refunded.status}${reasonSuffix(refunded.status_details)}`,
    );
  }

  return { createOrder, captureOrder, refund };
}

// Calls the global `fetch` unbound, which Workers require.
function globalFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

// The JSON body of a reply, the raw text when it is not JSON, `undefined` when empty.
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  message: string,
): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(message, { cause: parsed.error });

  return parsed.data;
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

// Pure.
function toError(action: string, failure: PayPalFailure): Error {
  const issue = failure.issue ? ` ${failure.issue}` : "";
  const description = failure.description ? `: ${failure.description}` : "";
  const debugId = failure.debugId ? ` (debug id ${failure.debugId})` : "";

  return new Error(
    `PayPal could not ${action} [${failure.status}${issue}]${description}${debugId}`,
    { cause: failure },
  );
}

// A refused capture the customer can act on becomes a failed charge; anything else throws.
function toDeclined(failure: PayPalFailure): CaptureOutcome {
  const reason = failure.status === 422 ? declineReasons.get(failure.issue ?? "") : undefined;
  if (!reason) throw toError("capture the order", failure);

  return { status: "failed", failureReason: reason };
}

function toCaptureOutcome(order: CapturedOrder): CaptureOutcome {
  const [capture] = order.purchase_units.flatMap((unit) => unit.payments?.captures ?? []);
  if (!capture) throw new Error(`PayPal order ${order.id} has no capture`);

  if (capture.status === "COMPLETED") {
    return { status: "succeeded", externalPaymentId: capture.id };
  }
  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    return {
      status: "failed",
      failureReason: `PayPal declined the payment${reasonSuffix(capture.status_details)}.`,
    };
  }

  // PENDING (held for review, or an eCheck clearing) has not moved the money
  // yet, so it is neither outcome. Throwing leaves the payment pending.
  throw new Error(
    `PayPal capture ${capture.id} is ${capture.status}${reasonSuffix(capture.status_details)}`,
  );
}

// Pure.
function reasonSuffix(details: { reason: string } | undefined): string {
  return details ? ` (${details.reason})` : "";
}

// Pure.
function toOrderBody(order: CreateProviderOrderInput) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.reference,
        description: `Async rental ${order.reference}`,
        amount: toPayPalAmount(order.amount, order.currency),
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
function toPayPalAmount(amount: number, currency: string) {
  const digits = currencyDigits.get(currency);
  if (digits === undefined) throw new Error(`PayPal does not accept ${currency}`);

  const minor = String(amount).padStart(digits + 1, "0");
  const whole = digits === 0 ? minor : minor.slice(0, -digits);
  const fraction = digits === 0 ? "" : minor.slice(-digits);

  if (!wholeUnitCurrencies.has(currency)) {
    return { currency_code: currency, value: fraction ? `${whole}.${fraction}` : whole };
  }
  if (/[^0]/.test(fraction)) {
    throw new Error(`PayPal only takes whole ${currency} amounts, got ${amount} minor units`);
  }

  return { currency_code: currency, value: whole };
}
