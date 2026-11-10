/**
 * PayPal payment provider adapter using PayPal's Orders v2 and Payments v2 REST APIs.
 *
 * Docs: https://developer.paypal.com/docs/api/orders/v2/
 *       https://developer.paypal.com/docs/api/payments/v2/
 */
import type { PaymentProviderAdapter } from "./payment.js";

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

interface PayPalCapture {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
}

export class PayPalAdapter implements PaymentProviderAdapter {
  readonly provider = "paypal";

  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor(clientId: string, clientSecret: string, sandbox = true) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  }

  private async getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      throw new Error(`PayPal auth failed: ${res.status}`);
    }
    const data = await res.json();
    return (data as { access_token: string }).access_token;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal API ${method} ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as unknown as T;
  }

  async createOrder(
    amount: number,
    currency = "USD",
  ): Promise<{ orderId: string; approvalUrl: string }> {
    const body = {
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: currency, value: amount.toFixed(2) } }],
    };
    const order = await this.api<PayPalOrder>("POST", "/v2/checkout/orders", body);
    const approvalLink = order.links.find((l) => l.rel === "approve");
    if (!approvalLink) {
      throw new Error("PayPal order did not include an approval link");
    }
    return { orderId: order.id, approvalUrl: approvalLink.href };
  }

  async confirmOrder(orderId: string): Promise<{ status: "paid" | "failed"; capturedAt?: number }> {
    const capture = await this.api<PayPalCapture>(`POST`, `/v2/checkout/orders/${orderId}/capture`);
    if (capture.status === "COMPLETED") {
      return { status: "paid", capturedAt: Math.floor(Date.now() / 1000) };
    }
    return { status: "failed" };
  }

  async refund(orderId: string): Promise<{ success: boolean }> {
    try {
      await this.api<PayPalCapture>(`POST`, `/v2/payments/captures/${orderId}/refund`);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async verifyEvent(
    _payload: unknown,
    _signature?: string,
  ): Promise<{ orderId: string; status: string } | null> {
    // PayPal webhook verification would go here
    return null;
  }
}
