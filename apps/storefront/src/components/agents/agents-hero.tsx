import { Separator } from "@async-rent/ui/components/separator";

import { mcpServerUrl, setupPrompt } from "../../lib/agent-setup";
import { CopyButton } from "./copy-button";

const stack = [
  { name: "Claude", src: "/agents/claude.svg" },
  { name: "ChatGPT", src: "/agents/openai.svg" },
  { name: "Cursor", src: "/agents/cursor.svg" },
  { name: "Hermes Agent", src: "/agents/hermes-agent.png" },
] as const;

/** The agent page's opening: what an agent can do with Async, and the one prompt that sets it up. */
export function AgentsHero() {
  return (
    <section aria-labelledby="agents-title" className="bg-fog">
      <div className="mx-auto grid w-full max-w-360 grid-cols-1 items-center gap-10 px-5 py-14 md:px-10 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-16 lg:py-24 xl:px-20">
        <div className="flex flex-col gap-6 duration-500 animate-in fade-in slide-in-from-bottom-3 motion-reduce:animate-none">
          <p className="font-mono text-[10px] leading-3 tracking-[0.16em] text-primary uppercase">
            Async for AI agents
          </p>
          <h1
            id="agents-title"
            className="max-w-150 font-heading text-4xl leading-[1.02] tracking-[-0.02em] text-ink sm:text-5xl"
          >
            Rent desks, chairs and monitors through your AI agent
          </h1>
          <p className="max-w-130 text-[15px] leading-6 text-muted-foreground">
            Connect your agent to Async once. Ask for a setup in Bali, Chiang Mai, Da Nang or
            Lisbon, and it searches the gear, prices the week and books delivery. You approve every
            payment yourself.
          </p>
          <div className="flex items-center gap-3">
            <ul className="flex" aria-label="Works with">
              {stack.map((agent) => (
                <li
                  key={agent.name}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-fog bg-paper p-1.75 not-first:-ml-2"
                >
                  <img src={agent.src} alt={agent.name} className="size-full object-contain" />
                </li>
              ))}
            </ul>
            <p className="text-[13px] leading-4.5 text-ink">
              Claude, ChatGPT, Cursor, Hermes Agent
              <br />
              <span className="text-muted-foreground">and any agent that speaks MCP</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-xl border bg-paper p-5 shadow-[0_20px_50px_rgb(20_20_20/0.12)] delay-100 duration-500 animate-in fill-mode-both fade-in slide-in-from-bottom-3 sm:p-7 motion-reduce:animate-none">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[9px] leading-3 tracking-[0.12em] text-muted-foreground uppercase">
              Works in any agent
            </p>
            <h2 className="font-heading text-2xl leading-[1.15] tracking-[-0.01em] text-ink">
              Paste this into your agent
            </h2>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-fog py-2 pr-2 pl-4">
            <p className="min-w-0 flex-1 py-1.5 font-mono text-[13px] leading-5.5 break-all text-ink">
              {setupPrompt}
            </p>
            <CopyButton
              value={setupPrompt}
              label="setup prompt"
              variant="outline"
              size="icon-sm"
              className="shadow-none"
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[9px] leading-3 tracking-[0.12em] text-muted-foreground uppercase">
              Or add the MCP server yourself
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">
                {mcpServerUrl}
              </code>
              <CopyButton
                value={mcpServerUrl}
                label="MCP server URL"
                variant="outline"
                size="icon-sm"
                className="shadow-none"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
