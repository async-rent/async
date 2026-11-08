import type { StartPaymentResult } from "@async-rent/core";
import { getRentalByNumberInputSchema, startPaymentInputSchema } from "@async-rent/core";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import paypalCheckoutHtml from "../../dist/widgets/paypal-checkout/index.html?raw";
import { customerPaymentSchema, toCustomerPayment } from "../shared/payments";
import { getOwnRental } from "../shared/rentals";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";
import { registerWidget } from "../shared/widgets";

const paypalCheckoutUri = "ui://async/paypal-checkout.html";

type StartedPayment = Extract<StartPaymentResult, { success: true }>["data"];

const inputSchema = getRentalByNumberInputSchema.extend(
  startPaymentInputSchema.pick({ provider: true }).shape,
);

type Input = z.infer<typeof inputSchema>;

/** What the assistant passes start_payment, which the PayPal checkout widget reads. */
export type StartPaymentInput = Input;

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

/** The structured content start_payment returns, which the PayPal checkout widget renders. */
export type StartPaymentOutput = z.infer<typeof outputSchema>;

type Output = StartPaymentOutput;

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
  // PayPal opens in the customer's browser through the host, so the widget loads nothing.
  registerWidget(server, {
    name: "PayPal checkout",
    uri: paypalCheckoutUri,
    html: paypalCheckoutHtml,
    resourceDomains: [],
  });

  registerAppTool(
    server,
    "start_payment",
    {
      title: "Start payment",
      description:
        "Start paying one of the user's pending_payment rentals by its number, e.g. AR-2026-7KQ4M2: the first week, deposit and delivery (the rental's totalDueToday). Returns an approvalUrl for the customer to open and approve at the provider themselves; never open it for them or ask for card or account details. Once they say they approved, call confirm_payment. Calling again replaces the link with a fresh one, and if the customer had already approved, the status is paid instead. In hosts that support MCP Apps, the result also opens a PayPal checkout widget showing the total due today: its Pay with PayPal button lets the customer open the approval page themselves, and the widget then confirms the payment for them and tells you the outcome, so only call confirm_payment yourself when they say they approved and the outcome hasn't reached you. The widget never asks for a fresh link; call start_payment again when the customer needs one.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      _meta: { ui: { resourceUri: paypalCheckoutUri } },
    },
    async (input) => toToolResult(await startOwnPayment(context, input), toOutput),
  );
};
