import type { Rental } from "@async-rent/core";
import { getRentalByNumberInputSchema } from "@async-rent/core";
import { z } from "zod";
import { customerRentalSchema, getOwnRental, toCustomerRental } from "../shared/rentals";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = getRentalByNumberInputSchema;

const outputSchema = z.object({ rental: customerRentalSchema });

type Output = z.infer<typeof outputSchema>;

const toOutput = (rental: Rental): Output => ({ rental: toCustomerRental(rental) });

export const getRental: Tool = (server, context) => {
  server.registerTool(
    "get_rental",
    {
      title: "Get rental",
      description:
        "Look up one of the user's rentals by its number, e.g. AR-2026-7KQ4M2: its status, delivery progress, latest payment status, items, dates and agreed totals. Prices are integers in the location currency's minor unit, e.g. cents.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ number }) => toToolResult(await getOwnRental(context, number), toOutput),
  );
};
