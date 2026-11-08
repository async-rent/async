import {
  type App,
  useApp,
  useDocumentTheme,
  useHostStyles,
} from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useEffect, useState } from "react";

export interface HostedWidget {
  /** Set once the widget has connected to its host. */
  app: App | null;
  error: Error | null;
  /** The result of the tool call this widget is attached to, once the host sends it. */
  toolResult: CallToolResult | undefined;
}

/**
 * Connects a widget to the MCP Apps host and keeps it in the host's light or dark
 * theme and fonts. The host's style variables never override the brand colours,
 * because their names differ from the `@async-rent/ui` theme's.
 */
export function useHostedWidget(name: string): HostedWidget {
  const [toolResult, setToolResult] = useState<CallToolResult>();
  const { app, error } = useApp({
    appInfo: { name, version: "0.1.0" },
    capabilities: {},
    autoResize: true,
    // Handlers must be set before the app connects, or the first result is missed.
    onAppCreated: (created) => {
      created.ontoolresult = setToolResult;
    },
  });

  useHostStyles(app, app?.getHostContext());

  // The host sets `data-theme`; the UI package's dark palette keys off the `.dark` class.
  const theme = useDocumentTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return { app, error, toolResult };
}

/**
 * A tool result's structured content, or its text parsed as JSON for hosts that
 * only forward text. Our tools return the same JSON in both.
 */
export function structuredResult<TOutput>(result: CallToolResult): TOutput | undefined {
  if (result.isError) return undefined;
  if (result.structuredContent) return result.structuredContent as TOutput;

  const text = result.content.find((block) => block.type === "text");
  if (!text) return undefined;

  try {
    return JSON.parse(text.text) as TOutput;
  } catch {
    return undefined;
  }
}

/** The user-safe message of a failed tool result. */
export function errorMessage(result: CallToolResult): string | undefined {
  if (!result.isError) return undefined;

  const text = result.content.find((block) => block.type === "text");
  return text?.text ?? "Something went wrong.";
}
