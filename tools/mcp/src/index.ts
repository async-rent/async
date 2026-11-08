import { createAsync } from "@async-rent/core";
import { createPayPalAdapter } from "@async-rent/payment";
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
import { approvedPage, cancelledPage, paymentPagePaths } from "./pages/payment";
import { createMcpServer } from "./server";
import { paymentReturnUrls } from "./shared/payments";
import type { ToolContext } from "./shared/tools";

// Composes core with the payment providers this Worker's secrets configure.
function composeAsync(env: CloudflareBindings) {
  const db = drizzle(env.DATABASE);
  const paypal = createPayPalAdapter({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    // Sandbox until a deployment is ready to take real money.
    environment: "sandbox",
  });

  return createAsync({ db, paymentProviders: { paypal } });
}

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

  const context: ToolContext = {
    async: composeAsync(c.env),
    userId: auth.userId,
    paymentReturnUrls: paymentReturnUrls(new URL(c.req.url).origin),
    storefrontUrl: c.env.STOREFRONT_URL,
  };

  return streamableHttpHandler(() => createMcpServer(context))(c);
});

// The customer's browser lands here from the payment provider, outside OAuth.
app.get(paymentPagePaths.approved, (c) => c.html(approvedPage));
app.get(paymentPagePaths.cancelled, (c) => c.html(cancelledPage));

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
