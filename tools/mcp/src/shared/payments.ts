import type { Payment, Rental, StartPaymentInput } from "@async-rent/core";
import { paymentSchema } from "@async-rent/core";
import type { z } from "zod";
import { paymentPagePaths } from "../pages/payment";
import type { CoreResult, ToolContext } from "./tools";

export type PaymentReturnUrls = Pick<StartPaymentInput, "returnUrl" | "cancelUrl">;

/** This Worker's payment pages on `origin`, for the provider to send the customer back to. */
export const paymentReturnUrls = (origin: string): PaymentReturnUrls => ({
  returnUrl: new URL(paymentPagePaths.approved, origin).href,
  cancelUrl: new URL(paymentPagePaths.cancelled, origin).href,
});

/**
 * A payment as its customer sees it. The provider's order and charge ids stay
 * between Async and the provider: tools find a payment by its rental number, and
 * only the approval link reaches the assistant.
 */
export const customerPaymentSchema = paymentSchema.omit({
  externalOrderId: true,
  externalPaymentId: true,
});

export type CustomerPayment = z.infer<typeof customerPaymentSchema>;

export const toCustomerPayment = ({
  externalOrderId: _externalOrderId,
  externalPaymentId: _externalPaymentId,
  ...payment
}: Payment): CustomerPayment => payment;

/** Week 1 is paid at checkout; weekly billing charges the weeks after it. */
const checkoutBillingCycle = 1;

/** The rental's checkout payment, the one start_payment opens and confirm_payment settles. */
export async function getCheckoutPayment(
  { async }: ToolContext,
  rental: Rental,
): Promise<CoreResult<Payment>> {
  const payments = await async.payment.listPayments({ rentalId: rental.id });
  if (!payments.success) return payments;

  const payment = payments.data.find(({ billingCycle }) => billingCycle === checkoutBillingCycle);
  if (payment) return { success: true, data: payment };

  return {
    success: false,
    error: {
      code: "payment_not_started",
      message: `Rental ${rental.number} has no payment yet. Call start_payment first.`,
    },
  };
}
