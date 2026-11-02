import type { Location } from "@async-rent/core";
import { locationSchema } from "@async-rent/core";
import { z } from "zod";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const outputSchema = z.object({ locations: z.array(locationSchema) });

type Output = z.infer<typeof outputSchema>;

const toOutput = (locations: Location[]): Output => ({ locations });

export const listLocations: Tool = (server, { async }) => {
  server.registerTool(
    "list_locations",
    {
      title: "List locations",
      description:
        "List the cities Async rents workspace equipment in, with their currency, delivery fee and whether they are open for rentals. Use a location's id to filter search_products or price get_product.",
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async () => toToolResult(await async.catalog.listLocations(), toOutput),
  );
};
