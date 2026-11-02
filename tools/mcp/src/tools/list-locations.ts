import type { Tool } from "./tool";
import { toToolResult } from "./tool";

export const listLocations: Tool = (server, { async }) => {
  server.registerTool(
    "list_locations",
    {
      title: "List locations",
      description:
        "List the cities Async rents workspace equipment in, with their currency, delivery fee and whether they are open for rentals.",
      annotations: { readOnlyHint: true },
    },
    async () => toToolResult(await async.catalog.listLocations()),
  );
};
