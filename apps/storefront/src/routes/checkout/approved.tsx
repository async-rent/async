import { Button, buttonVariants } from "@async-rent/ui/components/button";
import { Spinner } from "@async-rent/ui/components/spinner";
import { useAuth } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  ConfirmingPayment,
  NoOrderReturn,
  PaidConfirmation,
  ReturnError,
  ReturnMessage,
  SignedOutReturn,
  UnpaidOrder,
} from "../../components/checkout/payment-return";
import { usePaymentConfirmation } from "../../hooks/use-payment-return";
import { paymentReturnSearchSchema, supportEmail } from "../../lib/checkout";

/**
 * Where PayPal sends the visitor once they approve the payment. Arriving here
 * takes the money, then shows the confirmation, or what to do when PayPal
 * declined or is still holding the payment.
 */
export const Route = createFileRoute("/checkout/approved")({
  validateSearch: paymentReturnSearchSchema,
  head: () => ({ meta: [{ title: "Your order — Async" }] }),
  component: ApprovedPage,
});

function ApprovedPage() {
  const { rental: number } = Route.useSearch();
  const { isLoaded, isSignedIn } = useAuth();
  const confirmation = usePaymentConfirmation(number);

  if (!number) return <NoOrderReturn />;
  if (!isLoaded) return <ConfirmingPayment />;
  if (!isSignedIn) return <SignedOutReturn />;
  if (confirmation.isPending) return <ConfirmingPayment />;

  if (confirmation.isError) {
    return (
      <ReturnError
        title="We couldn't confirm your payment"
        error={confirmation.error}
        onRetry={() => void confirmation.refetch()}
        isRetrying={confirmation.isFetching}
        reassurance="Trying again never charges you twice."
      />
    );
  }

  const result = confirmation.data;
  switch (result.outcome) {
    case "paid":
      return <PaidConfirmation order={result.order} />;
    case "declined":
      return (
        <UnpaidOrder
          order={result.order}
          title="Your payment didn't go through."
          reason={result.reason}
        />
      );
    case "processing":
      return (
        <ReturnMessage
          title="PayPal is holding your payment"
          actions={
            <>
              <Button
                onClick={() => void confirmation.refetch()}
                disabled={confirmation.isFetching}
              >
                {confirmation.isFetching && <Spinner data-icon="inline-start" />}
                Check again
              </Button>
              <a href={`mailto:${supportEmail}`} className={buttonVariants({ variant: "outline" })}>
                Email us
              </a>
            </>
          }
        >
          You approved it, but PayPal hasn't released the money yet. Order {result.number} is saved
          and will be confirmed once it does. Check again in a few minutes.
        </ReturnMessage>
      );
    case "unfinished":
      return (
        <ReturnMessage
          title="This payment isn't finished"
          actions={
            <Link to="/checkout" className={buttonVariants()}>
              Go to checkout
            </Link>
          }
        >
          Order {result.number} has a newer PayPal payment waiting, and nothing was charged here.
          Finish paying for it from checkout.
        </ReturnMessage>
      );
    case "cancelled":
      return (
        <ReturnMessage
          title={`Order ${result.number} was cancelled`}
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
