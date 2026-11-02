import type { StartPaymentInput } from "@async-rent/core";
import { html } from "hono/html";

/**
 * Where the payment provider sends the customer's browser back to. The customer
 * is signed in to their assistant, not to this Worker, so the pages are static:
 * they read no rental and take no money. The assistant's confirm_payment does.
 */
export const paymentPagePaths = {
  approved: "/payments/approved",
  cancelled: "/payments/cancelled",
} as const;

export type PaymentReturnUrls = Pick<StartPaymentInput, "returnUrl" | "cancelUrl">;

export const paymentReturnUrls = (origin: string): PaymentReturnUrls => ({
  returnUrl: new URL(paymentPagePaths.approved, origin).href,
  cancelUrl: new URL(paymentPagePaths.cancelled, origin).href,
});

// `html` escapes every interpolated value.
const page = (title: string, message: string) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>${title} · Async</title>
      </head>
      <body
        style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.5"
      >
        <h1>${title}</h1>
        <p>${message}</p>
      </body>
    </html>`;

export const approvedPage = page(
  "Payment approved",
  "Go back to your assistant and tell it you approved the payment, so it can confirm your rental. You can close this tab.",
);

export const cancelledPage = page(
  "Payment cancelled",
  "Nothing was charged. Go back to your assistant if you want a new payment link. You can close this tab.",
);
