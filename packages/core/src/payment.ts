/**
 * Interface for payment provider adapters.
 * Implementations handle the details of talking to a specific provider
 * (PayPal, Stripe, etc.) behind a common contract.
 */
export interface PaymentProviderAdapter {
  /** Provider name for auditing / payment records. */
  readonly provider: string;

  /** Create a payment intent/order for the given amount. Returns an order_id + approval URL. */
  createOrder(amount: number, currency: string): Promise<{ orderId: string; approvalUrl: string }>;

  /** Confirm a previously created order after the customer has approved it. */
  confirmOrder(orderId: string): Promise<{ status: "paid" | "failed"; capturedAt?: number }>;

  /** Refund an already captured payment. */
  refund(orderId: string): Promise<{ success: boolean }>;

  /** Verify a webhook/event payload from the provider. */
  verifyEvent(
    payload: unknown,
    signature?: string,
  ): Promise<{ orderId: string; status: string } | null>;
}
