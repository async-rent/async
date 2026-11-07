/**
 * Where agents connect to Async. The MCP Worker (`tools/mcp`) serves MCP at
 * `/mcp` only, and `public/SETUP.md` names the same URL, so change both together.
 */
export const mcpServerUrl = "https://async-rent-mcp-dev.luckzivanius.workers.dev/mcp";

/** The agent-readable setup guide this storefront serves from `public/SETUP.md`. */
export const setupGuideUrl = "https://async-rent-storefront-dev.luckzivanius.workers.dev/SETUP.md";

/** The one prompt that sets Async up in any agent that can read a URL. */
export const setupPrompt = `Install and set up ${setupGuideUrl}`;

/** The server name every install command and config uses. */
export const mcpServerName = "async";

/** A server config as the Cursor and Hermes install links take it: base64 JSON, escaped for a query string. */
function encodeConfig(config: Record<string, string>): string {
  return encodeURIComponent(btoa(JSON.stringify(config)));
}

/** Opens Cursor's MCP install dialog with the server filled in. */
export const cursorInstallLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${mcpServerName}&config=${encodeConfig({ url: mcpServerUrl })}`;

/** Opens the Hermes desktop app's MCP install dialog with the server filled in. */
export const hermesInstallLink = `hermes://mcp/install?name=${mcpServerName}&config=${encodeConfig({ url: mcpServerUrl, auth: "oauth" })}`;
