import { createFileRoute } from "@tanstack/react-router";

import { AgentSetupTabs } from "../../components/agents/agent-setup-tabs";
import { AgentsHero } from "../../components/agents/agents-hero";

/** The "Agent" side of the header's Human / Agent switch: how to connect an AI agent to Async. */
export const Route = createFileRoute("/_storefront/agents")({
  head: () => ({
    meta: [
      { title: "Async for AI agents — Connect Claude, ChatGPT and more" },
      {
        name: "description",
        content:
          "Connect Claude, ChatGPT, Cursor, Codex, Hermes Agent or any MCP agent to Async and rent workspace gear by asking.",
      },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <>
      <AgentsHero />
      <AgentSetupTabs />
    </>
  );
}
