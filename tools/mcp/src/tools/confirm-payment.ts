import type { Payment } from "@async-rent/core";
import { getRentalByNumberInputSchema } from "@async-rent/core";
import { z } from "zod";
import { customerPaymentSchema, getCheckoutPayment, toCustomerPayment } from "../shared/payments";
import { getOwnRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = getRentalByNumberInputSchema;

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({ payment: customerPaymentSchema });

type Output = z.infer<typeof outputSchema>;

const toOutput = (payment: Payment): Output => ({ payment: toCustomerPayment(payment) });

// The order is the one the rental's checkout payment points at, which is the
// link start_payment last handed out, so the agent never sees a provider id.
async function confirmOwnPayment(
  context: ToolContext,
  { number }: Input,
): Promise<CoreResult<Payment>> {
  const rental = await getOwnRental(context, number);
  if (!rental.success) return rental;

  const payment = await getCheckoutPayment(context, rental.data);
  if (!payment.success) return payment;

  const { provider, externalOrderId } = payment.data;

  return context.async.payment.confirmPayment({
    provider,
    externalOrderId,
    rentalId: rental.data.id,
  });
}

export const confirmPayment: Tool = (server, context) => {
  server.registerTool(
    "confirm_payment",
    {
      title: "Confirm payment",
      description:
        "Take the payment for one of the user's rentals by its number, e.g. AR-2026-7KQ4M2, once the customer says they approved it at the start_payment link. status succeeded means paid: the rental is confirmed and weekly billing has started. status failed carries failureReason; call start_payment for a fresh link. Only call after the customer approved, since confirming earlier records the payment as failed. Calling again returns the same outcome without charging twice.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => toToolResult(await confirmOwnPayment(context, input), toOutput),
  );
};
