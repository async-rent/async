import type { StartPaymentResult } from "@async-rent/core";
import { getRentalByNumberInputSchema, startPaymentInputSchema } from "@async-rent/core";
import { z } from "zod";
import { customerPaymentSchema, toCustomerPayment } from "../shared/payments";
import { getOwnRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

type StartedPayment = Extract<StartPaymentResult, { success: true }>["data"];

const inputSchema = getRentalByNumberInputSchema.extend(
  startPaymentInputSchema.pick({ provider: true }).shape,
);

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  status: z
    .enum(["awaiting_approval", "paid"])
    .describe(
      "awaiting_approval: the customer still has to approve at approvalUrl. paid: an approval they gave earlier went through, so there is nothing to approve.",
    ),
  payment: customerPaymentSchema,
  approvalUrl: z
    .url()
    .optional()
    .describe(
      "Link the customer opens themselves to approve the charge at the provider; absent when paid.",
    ),
});

type Output = z.infer<typeof outputSchema>;

const toOutput = (started: StartedPayment): Output => {
  const payment = toCustomerPayment(started.payment);
  if (started.status === "paid") return { status: started.status, payment };

  return { status: started.status, payment, approvalUrl: started.approvalUrl };
};

async function startOwnPayment(
  context: ToolContext,
  { number, provider }: Input,
): Promise<CoreResult<StartedPayment>> {
  const rental = await getOwnRental(context, number);
  if (!rental.success) return rental;

  return context.async.payment.startPayment({
    rentalId: rental.data.id,
    provider,
    ...context.paymentReturnUrls,
  });
}

export const startPayment: Tool = (server, context) => {
  server.registerTool(
    "start_payment",
    {
      title: "Start payment",
      description:
        "Start paying one of the user's pending_payment rentals by its number, e.g. AR-2026-7KQ4M2: the first week, deposit and delivery (the rental's totalDueToday). Returns an approvalUrl for the customer to open and approve at the provider themselves; never open it for them or ask for card or account details. Once they say they approved, call confirm_payment. Calling again replaces the link with a fresh one, and if the customer had already approved, the status is paid instead.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => toToolResult(await startOwnPayment(context, input), toOutput),
  );
};
