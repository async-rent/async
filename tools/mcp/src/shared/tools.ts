import type { Async, Err, OkWith } from "@async-rent/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PaymentReturnUrls } from "./payments";

export interface ToolContext {
  async: Async;
  /** Clerk user the OAuth access token was issued to; carts and rentals are scoped to them. */
  userId: string;
  /** This Worker's pages the payment provider sends the customer back to. */
  paymentReturnUrls: PaymentReturnUrls;
}

/** Registers one tool on a fresh per-request server. */
export type Tool = (server: McpServer, context: ToolContext) => void;

/** MCP structured content must be an object, so list results are wrapped in a named field. */
export type ToolOutput = Record<string, unknown>;

/** Any core service result: success with data, or a failure with a user-safe message. */
export type CoreResult<TData> = OkWith<TData> | Err<string>;

/**
 * Core result → MCP tool result.
 *
 * Success maps the data through `toOutput` into the tool's `outputSchema` shape and
 * returns it as structured content, plus the same JSON as text for clients that
 * only read text. Failure returns only the user-safe message as `isError`; the
 * full error and its cause are logged.
 */
export function toToolResult<TData, TOutput extends ToolOutput>(
  result: CoreResult<TData>,
  toOutput: (data: TData) => TOutput,
): CallToolResult {
  if (!result.success) {
    console.error(result.error);
    return { isError: true, content: [{ type: "text", text: result.error.message }] };
  }

  const output = toOutput(result.data);

  return { structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
}
