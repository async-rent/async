import type { Payment } from "@async-rent/core";
import { getRentalByNumberInputSchema } from "@async-rent/core";
import { z } from "zod";
import { customerPaymentSchema, toCustomerPayment } from "../shared/payments";
import { getOwnRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = getRentalByNumberInputSchema;

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({ payments: z.array(customerPaymentSchema) });

type Output = z.infer<typeof outputSchema>;

const toOutput = (payments: Payment[]): Output => ({
  payments: payments.map(toCustomerPayment),
});

async function listOwnPayments(
  context: ToolContext,
  { number }: Input,
): Promise<CoreResult<Payment[]>> {
  const rental = await getOwnRental(context, number);
  if (!rental.success) return rental;

  return context.async.payment.listPayments({ rentalId: rental.data.id });
}

export const listPayments: Tool = (server, context) => {
  server.registerTool(
    "list_payments",
    {
      title: "List payments",
      description:
        "Report the payment status of one of the user's rentals by its number, e.g. AR-2026-7KQ4M2: every charge, oldest week first. Week 1 is paid at checkout with start_payment and confirm_payment; weekly billing charges each week after it. Each charge has its status (pending, authorized, succeeded, failed or refunded), amount and failure reason. Amounts are integers in the currency's minor unit, e.g. cents. Empty until start_payment is called.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => toToolResult(await listOwnPayments(context, input), toOutput),
  );
};
