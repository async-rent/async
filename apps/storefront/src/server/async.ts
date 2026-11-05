import { createAsync, type Err, type Ok, type OkWith } from "@async-rent/core";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

/**
 * Composes core over this Worker's D1 binding. The storefront takes no
 * payments yet, so no payment providers are passed in.
 */
export const getAsync = createServerOnlyFn(() => createAsync({ db: drizzle(env.DATABASE) }));

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
