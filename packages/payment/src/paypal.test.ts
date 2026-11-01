import { describe, expect, it, vi } from "vite-plus/test";
import { createPayPalAdapter } from "./paypal";
import type { PayPalFetch } from "./paypal";

const sandbox = "https://api-m.sandbox.paypal.com";
const approvalUrl = "https://www.sandbox.paypal.com/checkoutnow?token=ORDER1";

const order = {
  reference: "AR-2026-AAAAAA",
  amount: 37000,
  currency: "USD",
  returnUrl: "https://async.rent/paid",
  cancelUrl: "https://async.rent/cart",
};

interface Reply {
  status?: number;
  body?: unknown;
}

const tokenReply: Reply = { body: { access_token: "access-token", expires_in: 32400 } };
// Loud on purpose: a 404 means "expired order" to `getOrder`, so a mistyped
// path must not quietly read as one.
const unknownPath: Reply = { status: 500, body: { name: "UNSTUBBED_PATH" } };

// A PayPal that answers each path with a fixed reply and records what it was sent.
function stubPayPal(replies: Record<string, Reply>) {
  const fetch = vi.fn<PayPalFetch>(async (url) => {
    const path = new URL(url).pathname;
    const reply = replies[path] ?? (path === "/v1/oauth2/token" ? tokenReply : unknownPath);
    const status = reply.status ?? 200;

    return reply.body === undefined
      ? new Response(null, { status })
      : Response.json(reply.body, { status });
  });

  const adapter = createPayPalAdapter({ clientId: "client", clientSecret: "secret", fetch });

  // The headers and JSON body last sent to `path`.
  const sentTo = (path: string) => {
    const [, init] = fetch.mock.calls.filter(([url]) => url === `${sandbox}${path}`).at(-1) ?? [];
    const headers = new Headers(init?.headers);
    const isJson = headers.get("Content-Type") === "application/json";
    const body = isJson && typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

    return { headers, body };
  };

  return { adapter, fetch, sentTo };
}

const failure = (code: string, message: string) => ({
  success: false,
  error: { code, message: expect.stringContaining(message) },
});

const createdOrder = {
  id: "ORDER1",
  status: "PAYER_ACTION_REQUIRED",
  links: [
    { href: `${sandbox}/v2/checkout/orders/ORDER1`, rel: "self", method: "GET" },
    { href: approvalUrl, rel: "payer-action", method: "GET" },
  ],
};

const capturedOrder = (capture: Record<string, unknown>) => ({
  id: "ORDER1",
  status: "COMPLETED",
  purchase_units: [{ reference_id: order.reference, payments: { captures: [capture] } }],
});

const paypalError = (status: number, issue: string) => ({
  status,
  body: {
    name: "UNPROCESSABLE_ENTITY",
    message: "The requested action could not be performed.",
    debug_id: "debug-1",
    details: [{ issue, description: `${issue} happened.` }],
  },
});

describe("createOrder", () => {
  const ordersPath = "/v2/checkout/orders";

  it("opens a captured order in the sandbox and returns where the customer approves it", async () => {
    const paypal = stubPayPal({ [ordersPath]: { status: 201, body: createdOrder } });

    const result = await paypal.adapter.createOrder(order);

    expect(result).toEqual({ success: true, data: { externalOrderId: "ORDER1", approvalUrl } });
    expect(paypal.sentTo("/v1/oauth2/token").headers.get("Authorization")).toBe(
      `Basic ${btoa("client:secret")}`,
    );

    const sent = paypal.sentTo(ordersPath);
    expect(sent.headers.get("Authorization")).toBe("Bearer access-token");
    expect(sent.body).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [
        { reference_id: order.reference, amount: { currency_code: "USD", value: "370.00" } },
      ],
      payment_source: {
        paypal: {
          experience_context: { return_url: order.returnUrl, cancel_url: order.cancelUrl },
        },
      },
    });
  });

  it.each([
    { amount: 5, currency: "USD", value: "0.05" },
    { amount: 123456, currency: "EUR", value: "1234.56" },
    { amount: 4500, currency: "JPY", value: "4500" },
    { amount: 150000, currency: "HUF", value: "1500" },
  ])("sends $amount $currency minor units as $value", async ({ amount, currency, value }) => {
    const paypal = stubPayPal({ [ordersPath]: { status: 201, body: createdOrder } });

    await paypal.adapter.createOrder({ ...order, amount, currency });

    expect(paypal.sentTo(ordersPath).body.purchase_units[0].amount).toEqual({
      currency_code: currency,
      value,
    });
  });

  it.each([
    { name: "a fractional amount PayPal only takes whole", currency: "HUF", amount: 150050 },
    { name: "a currency PayPal does not accept", currency: "IDR", amount: 37000 },
    { name: "a zero amount PayPal would refuse", currency: "USD", amount: 0 },
    { name: "input that breaks the provider contract", currency: "USD", amount: -1 },
  ])("refuses $name before calling PayPal", async ({ currency, amount }) => {
    const paypal = stubPayPal({});

    const result = await paypal.adapter.createOrder({ ...order, currency, amount });

    expect(result).toMatchObject({ success: false, error: { code: "invalid_request" } });
    expect(paypal.fetch).not.toHaveBeenCalled();
  });

  it("fails with PayPal's issue and debug id when it refuses the order", async () => {
    const paypal = stubPayPal({ [ordersPath]: paypalError(422, "CURRENCY_NOT_SUPPORTED") });

    const result = await paypal.adapter.createOrder(order);

    expect(result).toMatchObject({
      ...failure(
        "provider_refused",
        "PayPal could not create the order [422 CURRENCY_NOT_SUPPORTED]: CURRENCY_NOT_SUPPORTED happened. (debug id debug-1)",
      ),
      error: { cause: { status: 422, issue: "CURRENCY_NOT_SUPPORTED", debugId: "debug-1" } },
    });
  });

  it("fails when the credentials are rejected", async () => {
    const paypal = stubPayPal({
      "/v1/oauth2/token": {
        status: 401,
        body: { error: "invalid_client", error_description: "Client Authentication failed" },
      },
    });

    const result = await paypal.adapter.createOrder(order);

    expect(result).toMatchObject(
      failure(
        "provider_refused",
        "PayPal could not sign in [401 invalid_client]: Client Authentication failed",
      ),
    );
  });

  it("fails when PayPal answers with something it does not recognise", async () => {
    const paypal = stubPayPal({ [ordersPath]: { status: 201, body: { id: "ORDER1", links: [] } } });

    const result = await paypal.adapter.createOrder(order);

    expect(result).toMatchObject(
      failure("provider_response_invalid", "PayPal order ORDER1 has no approval link"),
    );
  });

  it("fails when PayPal cannot be reached", async () => {
    const fetch = vi.fn<PayPalFetch>(() => Promise.reject(new TypeError("fetch failed")));
    const adapter = createPayPalAdapter({ clientId: "client", clientSecret: "secret", fetch });

    const result = await adapter.createOrder(order);

    expect(result).toMatchObject(failure("provider_unreachable", "PayPal could not be reached"));
  });

  it("fails without throwing when fetch throws before returning a promise", async () => {
    const fetch = vi.fn<PayPalFetch>(() => {
      throw new TypeError("Invalid URL");
    });
    const adapter = createPayPalAdapter({ clientId: "client", clientSecret: "secret", fetch });

    const result = await adapter.createOrder(order);

    expect(result).toMatchObject(failure("provider_unreachable", "PayPal could not be reached"));
  });

  it("talks to live PayPal only when asked to", async () => {
    const fetch = vi.fn<PayPalFetch>(async () => Response.json({}, { status: 500 }));
    const adapter = createPayPalAdapter({
      clientId: "client",
      clientSecret: "secret",
      environment: "live",
      fetch,
    });

    await adapter.createOrder(order);

    expect(fetch.mock.calls[0]?.[0]).toBe("https://api-m.paypal.com/v1/oauth2/token");
  });
});

const orderPath = "/v2/checkout/orders/ORDER1";

describe("captureOrder", () => {
  const capturePath = "/v2/checkout/orders/ORDER1/capture";
  const capture = { externalOrderId: "ORDER1" };

  it("collects the money and returns the capture id", async () => {
    const paypal = stubPayPal({
      [capturePath]: { status: 201, body: capturedOrder({ id: "CAPTURE1", status: "COMPLETED" }) },
    });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toEqual({
      success: true,
      data: { status: "succeeded", externalPaymentId: "CAPTURE1" },
    });
    expect(paypal.sentTo(capturePath).headers.get("PayPal-Request-Id")).toBe("capture-ORDER1");
  });

  it("reports a refused payment method as a failed charge", async () => {
    const paypal = stubPayPal({ [capturePath]: paypalError(422, "INSTRUMENT_DECLINED") });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toEqual({
      success: true,
      data: {
        status: "failed",
        failureReason: "The payment method was declined. Try another one.",
      },
    });
  });

  it("reports a declined capture as a failed charge", async () => {
    const paypal = stubPayPal({
      [capturePath]: {
        status: 201,
        body: capturedOrder({
          id: "CAPTURE1",
          status: "DECLINED",
          status_details: { reason: "DECLINED_BY_RISK_FRAUD_FILTERS" },
        }),
      },
    });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toEqual({
      success: true,
      data: {
        status: "failed",
        failureReason: "PayPal declined the payment (DECLINED_BY_RISK_FRAUD_FILTERS).",
      },
    });
  });

  it("fails while a capture is pending, so the payment stays pending", async () => {
    const paypal = stubPayPal({
      [capturePath]: {
        status: 201,
        body: capturedOrder({
          id: "CAPTURE1",
          status: "PENDING",
          status_details: { reason: "PENDING_REVIEW" },
        }),
      },
    });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toMatchObject(
      failure("payment_pending", "PayPal capture CAPTURE1 is PENDING (PENDING_REVIEW)"),
    );
  });

  it("reads a pending capture again and collects it once it has completed", async () => {
    const paypal = stubPayPal({
      [capturePath]: {
        status: 201,
        body: capturedOrder({ id: "CAPTURE1", status: "PENDING" }),
      },
      "/v2/payments/captures/CAPTURE1": { body: { id: "CAPTURE1", status: "COMPLETED" } },
    });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toEqual({
      success: true,
      data: { status: "succeeded", externalPaymentId: "CAPTURE1" },
    });
  });

  it("reads the order when PayPal no longer replays an earlier capture", async () => {
    const paypal = stubPayPal({
      [capturePath]: paypalError(422, "ORDER_ALREADY_CAPTURED"),
      [orderPath]: { body: capturedOrder({ id: "CAPTURE1", status: "COMPLETED" }) },
    });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toEqual({
      success: true,
      data: { status: "succeeded", externalPaymentId: "CAPTURE1" },
    });
  });

  it("fails on a refusal that is not about the customer", async () => {
    const paypal = stubPayPal({ [capturePath]: paypalError(422, "ORDER_EXPIRED") });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toMatchObject({
      ...failure("provider_refused", "[422 ORDER_EXPIRED]"),
      error: { cause: { status: 422, issue: "ORDER_EXPIRED", debugId: "debug-1" } },
    });
  });

  it("never reads a refused sign-in as a declined payment", async () => {
    const paypal = stubPayPal({ "/v1/oauth2/token": paypalError(422, "INSTRUMENT_DECLINED") });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toMatchObject(
      failure("provider_refused", "PayPal could not sign in [422 INSTRUMENT_DECLINED]"),
    );
  });

  it("fails when PayPal fails", async () => {
    const paypal = stubPayPal({ [capturePath]: { status: 503 } });

    const result = await paypal.adapter.captureOrder(capture);

    expect(result).toMatchObject(
      failure("provider_refused", "PayPal could not capture the order [503]"),
    );
  });
});

describe("getOrder", () => {
  const lookup = { externalOrderId: "ORDER1" };

  it("reports an APPROVED order as approved, since a capture may be under way", async () => {
    const paypal = stubPayPal({ [orderPath]: { body: { id: "ORDER1", status: "APPROVED" } } });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toEqual({ success: true, data: { status: "approved" } });
  });

  it.each(["CREATED", "PAYER_ACTION_REQUIRED", "VOIDED"])(
    "reports a %s order as open, since no money has moved or can",
    async (status) => {
      const paypal = stubPayPal({ [orderPath]: { body: { id: "ORDER1", status } } });

      const result = await paypal.adapter.getOrder(lookup);

      expect(result).toEqual({ success: true, data: { status: "open" } });
      expect(paypal.fetch.mock.calls.at(-1)?.[1].method).toBe("GET");
    },
  );

  it("reports a captured order's payment", async () => {
    const paypal = stubPayPal({
      [orderPath]: { body: capturedOrder({ id: "CAPTURE1", status: "COMPLETED" }) },
    });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toEqual({
      success: true,
      data: { status: "succeeded", externalPaymentId: "CAPTURE1" },
    });
  });

  it("fails while the order's capture is still pending", async () => {
    const paypal = stubPayPal({
      [orderPath]: { body: capturedOrder({ id: "CAPTURE1", status: "PENDING" }) },
      "/v2/payments/captures/CAPTURE1": { body: { id: "CAPTURE1", status: "PENDING" } },
    });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toMatchObject(failure("payment_pending", "PayPal capture CAPTURE1 is PENDING"));
  });

  it.each([
    { status: "PARTIALLY_REFUNDED", data: { status: "succeeded", externalPaymentId: "CAPTURE1" } },
    {
      status: "REFUNDED",
      data: { status: "failed", failureReason: "PayPal refunded the payment." },
    },
  ])("reports a $status capture as settled, never as pending", async ({ status, data }) => {
    const paypal = stubPayPal({
      [orderPath]: { body: capturedOrder({ id: "CAPTURE1", status }) },
    });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toEqual({ success: true, data });
  });

  it("fails on a capture status PayPal does not document", async () => {
    const paypal = stubPayPal({
      [orderPath]: { body: capturedOrder({ id: "CAPTURE1", status: "SOMETHING_NEW" }) },
    });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toMatchObject(
      failure("provider_response_invalid", "PayPal capture CAPTURE1 is SOMETHING_NEW"),
    );
  });

  it("fails on a completed order that shows no capture", async () => {
    const paypal = stubPayPal({ [orderPath]: { body: { id: "ORDER1", status: "COMPLETED" } } });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toMatchObject(
      failure("provider_response_invalid", "PayPal order ORDER1 has no capture"),
    );
  });

  it("reports an order PayPal dropped after it expired as open", async () => {
    const paypal = stubPayPal({
      [orderPath]: { status: 404, body: { name: "RESOURCE_NOT_FOUND" } },
    });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toEqual({ success: true, data: { status: "open" } });
  });

  it("fails when PayPal cannot say where the order stands", async () => {
    const paypal = stubPayPal({ [orderPath]: { status: 503 } });

    const result = await paypal.adapter.getOrder(lookup);

    expect(result).toMatchObject(
      failure("provider_refused", "PayPal could not read the order [503]"),
    );
  });
});

describe("refund", () => {
  const refundPath = "/v2/payments/captures/CAPTURE1/refund";
  const input = { externalPaymentId: "CAPTURE1", amount: 37000, currency: "USD" };

  it("returns what the capture has left to the customer, once per capture", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "COMPLETED" } },
    });

    const result = await paypal.adapter.refund(input);

    expect(result).toEqual({ success: true });

    const sent = paypal.sentTo(refundPath);
    // No amount, so a capture already partly refunded at PayPal is refunded in full.
    expect(sent.body).toEqual({});
    expect(sent.headers.get("PayPal-Request-Id")).toBe("refund-CAPTURE1");
  });

  it("fails while a refund is pending, so the payment stays paid until it settles", async () => {
    const paypal = stubPayPal({
      [refundPath]: {
        status: 201,
        body: { id: "REFUND1", status: "PENDING", status_details: { reason: "ECHECK" } },
      },
    });

    const result = await paypal.adapter.refund(input);

    expect(result).toMatchObject(
      failure("payment_pending", "PayPal refund REFUND1 is PENDING (ECHECK)"),
    );
  });

  it("reads a pending refund again and accepts it once it has completed", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "PENDING" } },
      "/v2/payments/refunds/REFUND1": { body: { id: "REFUND1", status: "COMPLETED" } },
    });

    expect(await paypal.adapter.refund(input)).toEqual({ success: true });
  });

  it("fails when a pending refund turns out to have failed", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "PENDING" } },
      "/v2/payments/refunds/REFUND1": { body: { id: "REFUND1", status: "FAILED" } },
    });

    const result = await paypal.adapter.refund(input);

    expect(result).toMatchObject(failure("provider_refused", "PayPal refund REFUND1 is FAILED"));
  });

  it("treats a capture that is already fully refunded as done", async () => {
    const paypal = stubPayPal({ [refundPath]: paypalError(422, "CAPTURE_FULLY_REFUNDED") });

    expect(await paypal.adapter.refund(input)).toEqual({ success: true });
  });

  it("fails when PayPal refuses the refund", async () => {
    const paypal = stubPayPal({ [refundPath]: paypalError(422, "REFUND_NOT_ALLOWED") });

    const result = await paypal.adapter.refund(input);

    expect(result).toMatchObject(
      failure("provider_refused", "PayPal could not refund the payment [422 REFUND_NOT_ALLOWED]"),
    );
  });

  it("fails when the refund failed at PayPal", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "FAILED" } },
    });

    const result = await paypal.adapter.refund(input);

    expect(result).toMatchObject(failure("provider_refused", "PayPal refund REFUND1 is FAILED"));
  });
});
