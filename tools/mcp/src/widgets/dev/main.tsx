import "../styles.css";
import {
  AppBridge,
  type McpUiHostContext,
  type McpUiStyles,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Sample, sampleLocations, widgetSamples } from "./samples";

type Theme = "light" | "dark";

interface LogEntry {
  id: number;
  kind: string;
  text: string;
}

// A stand-in for the host's font, so the widget visibly switches away from the page default.
// Hosts send any subset of the style variables; the type lists every key.
const hostStyles: McpUiHostContext["styles"] = {
  variables: { "--font-sans": 'Georgia, "Times New Roman", serif' } as McpUiStyles,
};

const firstKey = (record: Record<string, unknown>) => Object.keys(record)[0] ?? "";

/**
 * A fake MCP Apps host for building widgets in a normal browser tab. It loads the
 * widget page in an iframe, talks to it over the real ext-apps AppBridge, sends a
 * sample tool input and result, answers list_locations and the sample's
 * confirm_payment, and logs what the widget sends back. Open /dev/ under
 * `vp run dev:widgets`.
 */
function DevHost() {
  const [widgetKey, setWidgetKey] = useState(firstKey(widgetSamples));
  const widget = widgetSamples[widgetKey];
  const samples = widget?.samples ?? {};
  const [sampleKey, setSampleKey] = useState(firstKey(samples));
  const [theme, setTheme] = useState<Theme>("light");
  const [log, setLog] = useState<LogEntry[]>([]);
  const sample = samples[sampleKey];

  function pickWidget(key: string) {
    setWidgetKey(key);
    setSampleKey(firstKey(widgetSamples[key]?.samples ?? {}));
    setLog([]);
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-muted p-6 text-foreground">
      <header className="flex flex-wrap items-center gap-4 text-sm">
        <h1 className="font-medium">Widget dev host</h1>
        <label className="flex items-center gap-2">
          Widget
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={widgetKey}
            onChange={(event) => pickWidget(event.target.value)}
          >
            {Object.entries(widgetSamples).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Sample
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={sampleKey}
            onChange={(event) => {
              setSampleKey(event.target.value);
              setLog([]);
            }}
          >
            {Object.entries(samples).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Theme
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={theme}
            onChange={(event) => setTheme(event.target.value as Theme)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>

      {/* A fixed widget column, so a long log entry never squeezes the widget. */}
      <div className="grid gap-4 lg:grid-cols-[42rem_minmax(0,1fr)]">
        {widget && sample && (
          // A fresh iframe per sample, as a host renders a fresh widget per tool call.
          <WidgetFrame
            key={`${widgetKey}/${sampleKey}`}
            src={widget.src}
            title={widget.label}
            sample={sample}
            theme={theme}
            onLog={(kind, text) =>
              setLog((entries) => [{ id: Date.now() + Math.random(), kind, text }, ...entries])
            }
          />
        )}
        <section className="flex flex-col gap-2 text-sm">
          <h2 className="font-medium">What the widget sent</h2>
          {log.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
          <ol className="flex flex-col gap-2">
            {log.map((entry) => (
              <li key={entry.id} className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">{entry.kind}</p>
                <pre className="text-xs whitespace-pre-wrap">{entry.text}</pre>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

interface WidgetFrameProps {
  src: string;
  title: string;
  sample: Sample;
  theme: Theme;
  onLog: (kind: string, text: string) => void;
}

function WidgetFrame({ src, title, sample, theme, onLog }: WidgetFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [height, setHeight] = useState(320);
  // The bridge is created once per frame; keep the latest callbacks without reconnecting.
  const latest = useRef({ sample, theme, onLog });
  latest.current = { sample, theme, onLog };

  useEffect(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;

    const bridge = new AppBridge(
      null,
      { name: "Async widget dev host", version: "0.0.0" },
      { openLinks: {}, serverTools: {}, message: {}, updateModelContext: {} },
      {
        hostContext: {
          theme: latest.current.theme,
          styles: hostStyles,
          displayMode: "inline",
          platform: "web",
        },
      },
    );
    bridgeRef.current = bridge;
    // How many times this frame has called confirm_payment.
    let confirmCalls = 0;

    bridge.oninitialized = () => {
      const { sample: current } = latest.current;
      void bridge.sendToolInput({ arguments: current.input });
      void bridge.sendToolResult(current.result);
    };
    bridge.oncalltool = async ({ name, arguments: args }): Promise<CallToolResult> => {
      latest.current.onLog("callServerTool", `${name} ${JSON.stringify(args ?? {})}`);
      if (name === "list_locations") {
        const output = { locations: sampleLocations };
        return {
          structuredContent: output,
          content: [{ type: "text", text: JSON.stringify(output) }],
        };
      }
      const answers = latest.current.sample.confirmPayment;
      if (name === "confirm_payment" && answers) {
        const answer = answers[Math.min(confirmCalls, answers.length - 1)];
        confirmCalls += 1;
        if (answer) {
          const text = answer.content.find((block) => block.type === "text");
          latest.current.onLog(`confirm_payment answered (call ${confirmCalls})`, text?.text ?? "");
          return answer;
        }
      }
      return { isError: true, content: [{ type: "text", text: `The dev host has no ${name}.` }] };
    };
    bridge.onmessage = async ({ content }) => {
      const text = content.map((block) => (block.type === "text" ? block.text : `[${block.type}]`));
      latest.current.onLog("sendMessage", text.join("\n"));
      return {};
    };
    bridge.onupdatemodelcontext = async (params) => {
      latest.current.onLog("updateModelContext", JSON.stringify(params, null, 2));
      return {};
    };
    bridge.onopenlink = async ({ url }) => {
      latest.current.onLog("openLink", url);
      window.open(url, "_blank", "noopener");
      return {};
    };
    bridge.onsizechange = ({ height: next }) => {
      if (next !== undefined) setHeight(next);
    };

    void bridge.connect(new PostMessageTransport(target, target));

    return () => {
      bridgeRef.current = null;
      void bridge.close();
    };
  }, []);

  useEffect(() => {
    void bridgeRef.current?.sendHostContextChange({ theme });
  }, [theme]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      // Real hosts serve widgets from a separate origin with a CSP; this only blocks
      // popups and top navigation. Same origin lets the dev server's module scripts load.
      sandbox="allow-scripts allow-same-origin"
      style={{ height }}
      className="w-full rounded-xl border bg-background"
    />
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<DevHost />);
