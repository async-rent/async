import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./tools";
import { tools } from "./tools";

export function createMcpServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: "async", version: "0.1.0" });
  tools.forEach((registerTool) => registerTool(server, context));

  return server;
}
