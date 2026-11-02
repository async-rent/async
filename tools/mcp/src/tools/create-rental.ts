import type { Rental } from "@async-rent/core";
import {
  createRentalInputSchema,
  getCartByUserAndLocationInputSchema,
  isValidRentalPeriod,
} from "@async-rent/core";
import { z } from "zod";
import { customerRentalSchema, toCustomerRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

// The cart comes from the signed-in user and location, and internal notes are
// for Async's staff, so the agent sends neither.
const rentalDetailsSchema = z
  .object(createRentalInputSchema.shape)
  .omit({ cartId: true, notes: true });

const inputSchema = getCartByUserAndLocationInputSchema
  .pick({ locationId: true })
  .extend(rentalDetailsSchema.shape)
  .refine(isValidRentalPeriod, {
    error: "endDate cannot be before startDate and deliveryDate cannot be after startDate",
    path: ["endDate"],
  });

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({ rental: customerRentalSchema });

type Output = z.infer<typeof outputSchema>;

const toOutput = (rental: Rental): Output => ({ rental: toCustomerRental(rental) });

async function createOwnRental(
  { async, userId }: ToolContext,
  { locationId, ...details }: Input,
): Promise<CoreResult<Rental>> {
  const cart = await async.cart.getCartByUserAndLocation({ userId, locationId });
  if (!cart.success) return cart;

  return async.rental.createRental({ ...details, cartId: cart.data.id });
}

export const createRental: Tool = (server, context) => {
  server.registerTool(
    "create_rental",
    {
      title: "Create rental",
      description:
        "Place a rental from the basket last quoted with quote_rental in the same location, with the customer's contact, delivery address and rental dates. The cart is emptied and its stock reserved; the rental starts as pending_payment with the quoted totals frozen. Call quote_rental first and confirm the totals with the customer. Returns the rental and its number, e.g. AR-2026-7KQ4M2, for get_rental and cancel_rental.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => toToolResult(await createOwnRental(context, input), toOutput),
  );
};
