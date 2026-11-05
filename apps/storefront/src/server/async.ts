import {
  createAsync,
  type Err,
  type Ok,
  type OkWith,
  type PaymentProviders,
} from "@async-rent/core";
import { createPayPalAdapter } from "@async-rent/payment";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

// PayPal is configured from this Worker's secrets. Without them checkout
// fails with `provider_not_configured`, and the rest of the shop still works.
function paymentProviders(): PaymentProviders {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return {};

  return {
    paypal: createPayPalAdapter({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      // Sandbox until a deployment is ready to take real money.
      environment: "sandbox",
    }),
  };
}

/** Composes core over this Worker's D1 binding and the payment providers it has secrets for. */
export const getAsync = createServerOnlyFn(() =>
  createAsync({ db: drizzle(env.DATABASE), paymentProviders: paymentProviders() }),
);

/** Shopper-facing copy for error codes whose core message names internal ids. */
export type ErrorMessages = Partial<Record<string, string>>;

// A failure is logged with its cause and thrown with a user-facing message
// only, so the cause never reaches the browser.
function fail(error: Err<string>["error"], messages: ErrorMessages): never {
  console.error(error);
  throw new Error(messages[error.code] ?? error.message);
}

/** The data of a successful core result; throws on failure. */
export function unwrap<TData>(
  result: OkWith<TData> | Err<string>,
  messages: ErrorMessages = {},
): TData {
  if (!result.success) fail(result.error, messages);
  return result.data;
}

/** Asserts a core result that returns nothing succeeded; throws on failure. */
export function assertOk(result: Ok | Err<string>, messages: ErrorMessages = {}): void {
  if (!result.success) fail(result.error, messages);
}
