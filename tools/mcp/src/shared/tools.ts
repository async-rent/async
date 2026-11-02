import type { Async, Err, OkWith } from "@async-rent/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ToolContext {
  async: Async;
}

/** Registers one tool on a fresh per-request server. */
export type Tool = (server: McpServer, context: ToolContext) => void;

export function toToolResult(result: OkWith<unknown> | Err<string>): CallToolResult {
  if (!result.success) {
    console.error(result.error);
    return { isError: true, content: [{ type: "text", text: result.error.message }] };
  }

  return { content: [{ type: "text", text: JSON.stringify(result.data) }] };
}
