import { Hono } from "hono";
import { createMcpServer } from "./tools";

export type Env = {
  DB: D1Database;
  STOREFRONT_URL: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_SANDBOX: string;
};

export type Variables = {
  userId: string;
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", authHeader.slice(7));
  await next();
});

app.post("/mcp", async (c) => {
  const env = c.env;
  const userId = c.get("userId");
  const server = createMcpServer(env, userId);

  const body = await c.req.json<JsonRpcRequest>();
  const { id, method, params } = body;

  try {
    if (method === "initialize") {
      const result = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          resources: {},
          apps: {
            widgets: Object.fromEntries(server.widgets),
          },
        },
        serverInfo: { name: "async-rent", version: "0.1.0" },
      };
      return c.json({ jsonrpc: "2.0", id, result });
    }

    if (method === "tools/list") {
      const tools = Array.from(server.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return c.json({ jsonrpc: "2.0", id, result: { tools } });
    }

    if (method === "tools/call") {
      const { name: toolName, arguments: args } =
        (params as {
          name: string;
          arguments?: Record<string, unknown>;
        }) ?? {};
      const tool = server.tools.get(toolName);
      if (!tool) {
        return c.json(
          { jsonrpc: "2.0", id, error: { code: -32601, message: "Tool not found" } },
          404,
        );
      }
      const result = await tool.handler(args ?? {});
      return c.json({ jsonrpc: "2.0", id, result });
    }

    return c.json(
      { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } },
      404,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ jsonrpc: "2.0", id, error: { code: -32603, message } }, 500);
  }
});

app.get("/mcp/widgets/:name", async (c) => {
  const name = c.req.param("name");
  if (name === "setup-picker") {
    const html = await readWidgetHtml(name);
    return c.html(html);
  }
  if (name === "paypal-checkout") {
    const html = await readWidgetHtml(name);
    return c.html(html);
  }
  return c.json({ error: "Widget not found" }, 404);
});

async function readWidgetHtml(name: string): Promise<string> {
  return `<!DOCTYPE html><html lang="${name}"><head><meta charset="UTF-8"><title>${name}</title></head><body><h1>${name}</h1></body></html>`;
}

export default app;
