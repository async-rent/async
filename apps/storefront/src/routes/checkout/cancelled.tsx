import { buttonVariants } from "@async-rent/ui/components/button";
import { useAuth } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  NoOrderReturn,
  ReturnError,
  ReturnMessage,
  ReturnSkeleton,
  SignedOutReturn,
  UnpaidOrder,
} from "../../components/checkout/payment-return";
import { useOwnOrder } from "../../hooks/use-payment-return";
import { paymentReturnSearchSchema } from "../../lib/checkout";

/**
 * Where PayPal sends the visitor when they back out of paying. Nothing is
 * charged here and the payment is left alone: the order is shown, saved, with
 * a way to try PayPal again.
 */
export const Route = createFileRoute("/checkout/cancelled")({
  validateSearch: paymentReturnSearchSchema,
  head: () => ({ meta: [{ title: "Payment cancelled — Async" }] }),
  component: CancelledPage,
});

function CancelledPage() {
  const { rental: number } = Route.useSearch();
  const { isLoaded, isSignedIn } = useAuth();
  const own = useOwnOrder(number);

  if (!number) return <NoOrderReturn />;
  if (!isLoaded) return <ReturnSkeleton />;
  if (!isSignedIn) return <SignedOutReturn />;
  if (own.isPending) return <ReturnSkeleton />;

  if (own.isError) {
    return (
      <ReturnError
        title="We couldn't load your order"
        error={own.error}
        onRetry={() => void own.refetch()}
        isRetrying={own.isFetching}
      />
    );
  }

  const { status, order } = own.data;
  switch (status) {
    case "awaiting_payment":
      return <UnpaidOrder order={order} title="You left PayPal before paying." />;
    case "paid":
      return (
        <ReturnMessage
          title="This order is already paid"
          actions={
            <Link
              to="/checkout/approved"
              search={{ rental: order.number }}
              className={buttonVariants()}
            >
              See your order
            </Link>
          }
        >
          Order {order.number} went through earlier, so there's nothing left to pay.
        </ReturnMessage>
      );
    case "cancelled":
      return (
        <ReturnMessage
          title={`Order ${order.number} was cancelled`}
          actions={
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              Browse equipment
            </Link>
          }
        >
          There's nothing to pay for it. Add what you need to your cart to start a new order.
        </ReturnMessage>
      );
  }
}
