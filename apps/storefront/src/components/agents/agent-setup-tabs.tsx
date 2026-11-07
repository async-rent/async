import { buttonVariants } from "@async-rent/ui/components/button";
import { Separator } from "@async-rent/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@async-rent/ui/components/tabs";
import { RiArrowRightUpLine, RiPlugLine } from "@remixicon/react";
import { cn } from "cn";
import type { ReactNode } from "react";

import {
  cursorInstallLink,
  hermesInstallLink,
  mcpServerName,
  mcpServerUrl,
  setupPrompt,
} from "../../lib/agent-setup";
import { CodeBlock } from "./code-block";

interface SetupStep {
  text: ReactNode;
  /** A command, URL or prompt to copy. */
  code?: string;
  /** Where the step happens, opened in the agent's app or site. */
  link?: { label: string; href: string };
}

interface AgentClient {
  id: string;
  name: string;
  /** Where this setup applies, e.g. "claude.ai, desktop and mobile apps". */
  where: string;
  /** The client's own logo from `public/agents`; `undefined` shows a plug glyph. */
  icon?: string;
  steps: ReadonlyArray<SetupStep>;
}

const clients: ReadonlyArray<AgentClient> = [
  {
    id: "claude",
    name: "Claude",
    where: "claude.ai, desktop and mobile apps",
    icon: "/agents/claude.svg",
    steps: [
      {
        text: (
          <>
            In Claude, open <UiLabel>Customize › Connectors</UiLabel> and click{" "}
            <UiLabel>Add custom connector</UiLabel>.
          </>
        ),
        link: { label: "Open Connectors", href: "https://claude.ai/customize/connectors" },
      },
      {
        text: (
          <>
            Name it <UiLabel>Async</UiLabel> and paste the server URL. Leave the OAuth fields empty.
          </>
        ),
        code: mcpServerUrl,
      },
      {
        text: (
          <>
            Click <UiLabel>Add</UiLabel>, then <UiLabel>Connect</UiLabel>, and sign in with your
            Async account. On a Team or Enterprise plan, an Owner adds the connector under{" "}
            <UiLabel>Organization settings</UiLabel> first.
          </>
        ),
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    where: "chatgpt.com",
    icon: "/agents/openai.svg",
    steps: [
      {
        text: (
          <>
            Open <UiLabel>Plugins</UiLabel>, select the plus button, then{" "}
            <UiLabel>Add custom MCP server</UiLabel>.
          </>
        ),
        link: { label: "Open Plugins", href: "https://chatgpt.com/plugins" },
      },
      {
        text: (
          <>
            Name it <UiLabel>Async</UiLabel>, paste the server URL and choose{" "}
            <UiLabel>OAuth</UiLabel> for authentication.
          </>
        ),
        code: mcpServerUrl,
      },
      {
        text: (
          <>
            Confirm the warning, select <UiLabel>Create as a plugin</UiLabel> and install it.
          </>
        ),
      },
      {
        text: (
          <>
            In a chat, type <UiLabel>@</UiLabel>, pick <UiLabel>Async</UiLabel> and sign in when it
            asks.
          </>
        ),
      },
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    where: "Terminal and IDE",
    icon: "/agents/claude-code.svg",
    steps: [
      {
        text: "Add the server for every project.",
        code: `claude mcp add --transport http --scope user ${mcpServerName} ${mcpServerUrl}`,
      },
      {
        text: (
          <>
            Inside Claude Code, run <UiLabel>/mcp</UiLabel>, pick <UiLabel>{mcpServerName}</UiLabel>{" "}
            and choose <UiLabel>Authenticate</UiLabel>. Sign in in the browser tab it opens.
          </>
        ),
      },
    ],
  },
  {
    id: "codex",
    name: "Codex",
    where: "Codex CLI and IDE extension",
    icon: "/agents/openai.svg",
    steps: [
      {
        text: "Add the server.",
        code: `codex mcp add ${mcpServerName} --url ${mcpServerUrl}`,
      },
      {
        text: "Sign in with your Async account in the browser tab it opens.",
        code: `codex mcp login ${mcpServerName}`,
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    where: "Desktop app",
    icon: "/agents/cursor.svg",
    steps: [
      {
        text: "Open the install link and confirm in Cursor.",
        link: { label: "Add to Cursor", href: cursorInstallLink },
      },
      {
        text: (
          <>
            Or add it by hand to <UiLabel>~/.cursor/mcp.json</UiLabel>.
          </>
        ),
        code: JSON.stringify({ mcpServers: { [mcpServerName]: { url: mcpServerUrl } } }, null, 2),
      },
      {
        text: (
          <>
            In <UiLabel>Cursor Settings</UiLabel>, find <UiLabel>{mcpServerName}</UiLabel> under MCP
            and log in with your Async account.
          </>
        ),
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    where: "CLI and desktop app",
    icon: "/agents/hermes-agent.png",
    steps: [
      {
        text: "Add the server from your terminal.",
        code: `hermes mcp add ${mcpServerName} --url ${mcpServerUrl} --auth oauth`,
      },
      {
        text: "On the desktop app, the install link does the same after you confirm.",
        link: { label: "Add to Hermes", href: hermesInstallLink },
      },
      {
        text: (
          <>
            Sign in in the browser window that opens on the first connection. If the tools don't
            show, run <UiLabel>/reload-mcp</UiLabel>.
          </>
        ),
      },
    ],
  },
  {
    id: "other",
    name: "Other agents",
    where: "Any agent that reads a URL",
    steps: [
      {
        text: "Paste this prompt into your agent. It reads the guide, adds the server and asks you to sign in.",
        code: setupPrompt,
      },
      {
        text: (
          <>
            Or add it by hand: a remote Streamable HTTP server named{" "}
            <UiLabel>{mcpServerName}</UiLabel> at this URL, signed in with OAuth.
          </>
        ),
        code: mcpServerUrl,
      },
    ],
  },
];

/** "Set up your agent": one tab per agent app, each with its install steps. */
export function AgentSetupTabs() {
  return (
    <section
      aria-labelledby="set-up-your-agent"
      className="mx-auto flex w-full max-w-360 flex-col gap-8 px-5 pt-16 pb-20 md:px-10 xl:px-20"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="set-up-your-agent"
          className="font-heading text-3xl leading-[1.3] tracking-[-0.01em] text-ink"
        >
          Set up your agent
        </h2>
        <p className="max-w-140 text-sm leading-5.5 text-muted-foreground">
          Pick the app you use. Every setup ends the same way: you sign in to your Async account in
          the browser, so your agent rents as you.
        </p>
      </div>

      <Tabs
        defaultValue={clients[0]?.id}
        orientation="vertical"
        className="flex-col items-stretch gap-4 lg:flex-row lg:gap-6"
      >
        <TabsList className="grid h-fit w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 lg:flex lg:w-64 lg:shrink-0">
          {clients.map((client) => (
            <TabsTrigger
              key={client.id}
              value={client.id}
              className="h-11 justify-start gap-2.5 px-3"
            >
              <ClientIcon client={client} size="sm" />
              <span className="truncate">{client.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/*
          Every setup sits in the same grid cell, so the card is as tall as the
          longest one and keeps its height when the tab changes. The copies
          behind the active panel are invisible and inert: they only size it.
        */}
        {/* grid-cols-1 caps the column at the card's width, so long commands scroll inside their block. */}
        <div className="grid min-w-0 flex-1 grid-cols-1 rounded-xl border bg-paper p-5 sm:p-8">
          {clients.map((client) => (
            <div key={client.id} aria-hidden="true" inert className="invisible [grid-area:1/1]">
              <ClientSetup client={client} />
            </div>
          ))}
          {clients.map((client) => (
            <TabsContent
              key={client.id}
              value={client.id}
              className="min-w-0 duration-200 [grid-area:1/1] animate-in fade-in motion-reduce:animate-none"
            >
              <ClientSetup client={client} />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </section>
  );
}

function ClientSetup({ client }: { client: AgentClient }) {
  return (
    // Fills the card, so the closing line sits at the same place on every tab.
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        <ClientIcon client={client} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-heading text-2xl leading-[1.15] tracking-[-0.01em] text-ink">
            {client.name}
          </h3>
          <p className="text-[13px] text-muted-foreground">{client.where}</p>
        </div>
      </div>

      <Separator />

      <ol className="flex flex-1 flex-col gap-6">
        {client.steps.map((step, index) => (
          <li key={index} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fog font-mono text-[11px] text-ink"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.75">
              <p className="text-sm leading-5.5 text-ink">{step.text}</p>
              {step.code && <CodeBlock code={step.code} />}
              {step.link && (
                <a
                  href={step.link.href}
                  // Web pages open beside this one; an app's install link
                  // (cursor://, hermes://) hands off to the app, so no tab.
                  {...(step.link.href.startsWith("https:")
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "self-start rounded-full px-4 shadow-none",
                  })}
                >
                  {step.link.label}
                  <RiArrowRightUpLine data-icon="inline-end" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <Separator />

      <p className="text-[13px] leading-5 text-muted-foreground">
        Then ask:{" "}
        <span className="text-ink">
          “Find me a standing desk and an ergonomic chair in Lisbon for four weeks.”
        </span>{" "}
        Your agent prices it, books delivery and sends you a PayPal link to approve.
      </p>
    </div>
  );
}

/** The client's logo on a paper tile, so dark marks read on the muted tab list too. */
function ClientIcon({ client, size }: { client: AgentClient; size: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border bg-paper text-ink",
        size === "sm" ? "size-6 rounded-md p-1" : "size-11 rounded-lg p-2",
      )}
    >
      {client.icon ? (
        <img src={client.icon} alt="" className="size-full object-contain" />
      ) : (
        <RiPlugLine className="size-full" />
      )}
    </span>
  );
}

/** A label as the agent app writes it: a menu, button or command. */
function UiLabel({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}
