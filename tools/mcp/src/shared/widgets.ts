import { RESOURCE_MIME_TYPE, registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface Widget {
  /** Display name of the resource. */
  name: string;
  /** `ui://` URI a tool's `_meta.ui.resourceUri` points at. */
  uri: string;
  /** The widget's single self-contained HTML file, built by vite.widgets.config.ts. */
  html: string;
  /** Origins the widget loads images from; the host's iframe CSP blocks every other one. */
  resourceDomains: string[];
}

/** Serves a widget's HTML as an MCP Apps resource, which hosts render inline in the chat. */
export function registerWidget(server: McpServer, { name, uri, html, resourceDomains }: Widget) {
  registerAppResource(server, name, uri, {}, async () => ({
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: { ui: { csp: { resourceDomains } } },
      },
    ],
  }));
}
