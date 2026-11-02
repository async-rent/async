import { createAsync } from "@async-rent/core";
import { clerkMiddleware, getAuth } from "@clerk/hono";
import {
  authServerMetadataHandlerClerk,
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/hono";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMcpServer } from "./server";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Browser-based MCP clients must be able to read the 401 challenge that starts the OAuth flow.
app.use("*", cors({ origin: "*", exposeHeaders: ["WWW-Authenticate", "Mcp-Session-Id"] }));

app.get(
  "/.well-known/oauth-protected-resource/mcp",
  protectedResourceHandlerClerk({ scopes_supported: ["profile", "email"] }),
);
// Older MCP clients look for the authorization server metadata on the resource itself.
app.get("/.well-known/oauth-authorization-server", authServerMetadataHandlerClerk);

app.all("/mcp", clerkMiddleware(), mcpAuthClerk, async (c) => {
  // mcpAuthClerk has already verified the OAuth token; this narrows the type to its user.
  const auth = getAuth(c, { acceptsToken: "oauth_token" });
  if (!auth.isAuthenticated) return c.json({ error: "Unauthorized" }, 401);

  const async = createAsync({ db: drizzle(c.env.DATABASE) });

  return streamableHttpHandler(() => createMcpServer({ async, userId: auth.userId }))(c);
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
