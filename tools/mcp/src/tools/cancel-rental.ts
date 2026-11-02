import type { Rental } from "@async-rent/core";
import { cancelRentalInputSchema, getRentalByNumberInputSchema } from "@async-rent/core";
import { z } from "zod";
import { customerRentalSchema, getOwnRental, toCustomerRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = getRentalByNumberInputSchema.extend(
  cancelRentalInputSchema.pick({ reason: true }).shape,
);

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({ rental: customerRentalSchema });

type Output = z.infer<typeof outputSchema>;

const toOutput = (rental: Rental): Output => ({ rental: toCustomerRental(rental) });

async function cancelOwnRental(
  context: ToolContext,
  { number, reason }: Input,
): Promise<CoreResult<Rental>> {
  const rental = await getOwnRental(context, number);
  if (!rental.success) return rental;

  return context.async.rental.cancelRental({ rentalId: rental.data.id, reason });
}

export const cancelRental: Tool = (server, context) => {
  server.registerTool(
    "cancel_rental",
    {
      title: "Cancel rental",
      description:
        "Cancel one of the user's rentals by its number, e.g. AR-2026-7KQ4M2, and stop its weekly billing. Only rentals that are pending_payment, confirmed or active can be cancelled. Confirm with the customer before calling.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async (input) => toToolResult(await cancelOwnRental(context, input), toOutput),
  );
};
