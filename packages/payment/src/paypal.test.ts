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

// A PayPal that answers each path with a fixed reply and records what it was sent.
function stubPayPal(replies: Record<string, Reply>) {
  const fetch = vi.fn<PayPalFetch>(async (url) => {
    const path = new URL(url).pathname;
    const reply = replies[path] ?? (path === "/v1/oauth2/token" ? tokenReply : undefined);
    if (!reply) throw new Error(`Unexpected request to ${path}`);

    const status = reply.status ?? 200;
    if (reply.body === undefined) return new Response(null, { status });

    return Response.json(reply.body, { status });
  });

  const adapter = createPayPalAdapter({ clientId: "client", clientSecret: "secret", fetch });

  // The request sent to `path`, with its JSON body parsed.
  const sentTo = (path: string) => {
    const call = fetch.mock.calls.find(([url]) => url === `${sandbox}${path}`);
    if (!call) throw new Error(`Nothing was sent to ${path}`);

    const [, init] = call;
    const body = typeof init.body === "string" && path !== "/v1/oauth2/token" ? init.body : "";

    return { headers: new Headers(init.headers), body: body ? JSON.parse(body) : undefined };
  };

  return { adapter, fetch, sentTo };
}

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
  it("opens a captured order in the sandbox and returns where the customer approves it", async () => {
    const paypal = stubPayPal({ "/v2/checkout/orders": { status: 201, body: createdOrder } });

    const created = await paypal.adapter.createOrder(order);

    expect(created).toEqual({ externalOrderId: "ORDER1", approvalUrl });

    const token = paypal.fetch.mock.calls[0];
    expect(token?.[0]).toBe(`${sandbox}/v1/oauth2/token`);
    expect(new Headers(token?.[1].headers).get("Authorization")).toBe(
      `Basic ${btoa("client:secret")}`,
    );

    const sent = paypal.sentTo("/v2/checkout/orders");
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
    { amount: 0, currency: "USD", value: "0.00" },
  ])("sends $amount $currency minor units as $value", async ({ amount, currency, value }) => {
    const paypal = stubPayPal({ "/v2/checkout/orders": { status: 201, body: createdOrder } });

    await paypal.adapter.createOrder({ ...order, amount, currency });

    expect(paypal.sentTo("/v2/checkout/orders").body.purchase_units[0].amount).toEqual({
      currency_code: currency,
      value,
    });
  });

  it("refuses a fractional amount in a currency PayPal only takes whole", async () => {
    const paypal = stubPayPal({ "/v2/checkout/orders": { status: 201, body: createdOrder } });

    await expect(
      paypal.adapter.createOrder({ ...order, currency: "HUF", amount: 150050 }),
    ).rejects.toThrow("whole HUF");
    expect(paypal.fetch).not.toHaveBeenCalled();
  });

  it("refuses a currency PayPal does not accept before calling it", async () => {
    const paypal = stubPayPal({ "/v2/checkout/orders": { status: 201, body: createdOrder } });

    await expect(paypal.adapter.createOrder({ ...order, currency: "IDR" })).rejects.toThrow(
      "PayPal does not accept IDR",
    );
    expect(paypal.fetch).not.toHaveBeenCalled();
  });

  it("refuses input that breaks the provider contract before calling PayPal", async () => {
    const paypal = stubPayPal({});

    await expect(paypal.adapter.createOrder({ ...order, amount: -1 })).rejects.toThrow(
      "Invalid PayPal order",
    );
    expect(paypal.fetch).not.toHaveBeenCalled();
  });

  it("throws PayPal's issue and debug id when it refuses the order", async () => {
    const paypal = stubPayPal({
      "/v2/checkout/orders": paypalError(422, "CURRENCY_NOT_SUPPORTED"),
    });

    await expect(paypal.adapter.createOrder(order)).rejects.toThrow(
      "PayPal could not create the order [422 CURRENCY_NOT_SUPPORTED]: CURRENCY_NOT_SUPPORTED happened. (debug id debug-1)",
    );
  });

  it("throws when the credentials are rejected", async () => {
    const paypal = stubPayPal({
      "/v1/oauth2/token": {
        status: 401,
        body: { error: "invalid_client", error_description: "Client Authentication failed" },
      },
    });

    await expect(paypal.adapter.createOrder(order)).rejects.toThrow(
      "PayPal could not sign in [401 invalid_client]: Client Authentication failed",
    );
  });

  it("throws when PayPal cannot be reached", async () => {
    const fetch = vi.fn<PayPalFetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const adapter = createPayPalAdapter({ clientId: "client", clientSecret: "secret", fetch });

    await expect(adapter.createOrder(order)).rejects.toThrow("PayPal could not be reached");
  });

  it("talks to live PayPal only when asked to", async () => {
    const fetch = vi.fn<PayPalFetch>(async () => Response.json({}, { status: 500 }));
    const adapter = createPayPalAdapter({
      clientId: "client",
      clientSecret: "secret",
      environment: "live",
      fetch,
    });

    await expect(adapter.createOrder(order)).rejects.toThrow();
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api-m.paypal.com/v1/oauth2/token");
  });
});

describe("captureOrder", () => {
  const capturePath = "/v2/checkout/orders/ORDER1/capture";

  it("collects the money and returns the capture id", async () => {
    const paypal = stubPayPal({
      [capturePath]: { status: 201, body: capturedOrder({ id: "CAPTURE1", status: "COMPLETED" }) },
    });

    const outcome = await paypal.adapter.captureOrder({ externalOrderId: "ORDER1" });

    expect(outcome).toEqual({ status: "succeeded", externalPaymentId: "CAPTURE1" });
    expect(paypal.sentTo(capturePath).headers.get("PayPal-Request-Id")).toBe("capture-ORDER1");
  });

  it("reports a refused payment method as a failed charge", async () => {
    const paypal = stubPayPal({ [capturePath]: paypalError(422, "INSTRUMENT_DECLINED") });

    const outcome = await paypal.adapter.captureOrder({ externalOrderId: "ORDER1" });

    expect(outcome).toEqual({
      status: "failed",
      failureReason: "The payment method was declined. Try another one.",
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

    const outcome = await paypal.adapter.captureOrder({ externalOrderId: "ORDER1" });

    expect(outcome).toEqual({
      status: "failed",
      failureReason: "PayPal declined the payment (DECLINED_BY_RISK_FRAUD_FILTERS).",
    });
  });

  it("throws while a capture is pending, so the payment stays pending", async () => {
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

    await expect(paypal.adapter.captureOrder({ externalOrderId: "ORDER1" })).rejects.toThrow(
      "PayPal capture CAPTURE1 is PENDING (PENDING_REVIEW)",
    );
  });

  it("throws a refusal that is not about the customer", async () => {
    const paypal = stubPayPal({ [capturePath]: paypalError(422, "ORDER_ALREADY_CAPTURED") });

    await expect(paypal.adapter.captureOrder({ externalOrderId: "ORDER1" })).rejects.toMatchObject({
      message: expect.stringContaining("[422 ORDER_ALREADY_CAPTURED]"),
      cause: { status: 422, issue: "ORDER_ALREADY_CAPTURED", debugId: "debug-1" },
    });
  });

  it("throws when PayPal fails", async () => {
    const paypal = stubPayPal({ [capturePath]: { status: 503 } });

    await expect(paypal.adapter.captureOrder({ externalOrderId: "ORDER1" })).rejects.toThrow(
      "PayPal could not capture the order [503]",
    );
  });
});

describe("refund", () => {
  const refundPath = "/v2/payments/captures/CAPTURE1/refund";
  const input = { externalPaymentId: "CAPTURE1", amount: 37000, currency: "USD" };

  it("returns the amount to the customer once per capture", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "COMPLETED" } },
    });

    await expect(paypal.adapter.refund(input)).resolves.toBeUndefined();

    const sent = paypal.sentTo(refundPath);
    expect(sent.body).toEqual({ amount: { currency_code: "USD", value: "370.00" } });
    expect(sent.headers.get("PayPal-Request-Id")).toBe("refund-CAPTURE1");
  });

  it("accepts a refund PayPal is still processing", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "PENDING" } },
    });

    await expect(paypal.adapter.refund(input)).resolves.toBeUndefined();
  });

  it("treats a capture that is already fully refunded as done", async () => {
    const paypal = stubPayPal({ [refundPath]: paypalError(422, "CAPTURE_FULLY_REFUNDED") });

    await expect(paypal.adapter.refund(input)).resolves.toBeUndefined();
  });

  it("throws when PayPal refuses the refund", async () => {
    const paypal = stubPayPal({ [refundPath]: paypalError(422, "REFUND_NOT_ALLOWED") });

    await expect(paypal.adapter.refund(input)).rejects.toThrow(
      "PayPal could not refund the payment [422 REFUND_NOT_ALLOWED]",
    );
  });

  it("throws when the refund failed at PayPal", async () => {
    const paypal = stubPayPal({
      [refundPath]: { status: 201, body: { id: "REFUND1", status: "FAILED" } },
    });

    await expect(paypal.adapter.refund(input)).rejects.toThrow("PayPal refund REFUND1 is FAILED");
  });
});
