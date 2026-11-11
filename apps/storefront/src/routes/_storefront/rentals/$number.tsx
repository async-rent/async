import { rentalNumberSchema } from "@async-rent/core";
import { buttonVariants } from "@async-rent/ui/components/button";
import { useAuth } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";

import { ReturnError, ReturnMessage } from "../../../components/checkout/payment-return";
import { RentalOverview, RentalSkeleton } from "../../../components/rentals/rental-overview";
import { SignInPrompt } from "../../../components/rentals/sign-in-prompt";
import { useMyRental } from "../../../hooks/use-my-rentals";

/**
 * One of the signed-in customer's rentals, by its number. Someone else's, or
 * a number that doesn't exist, reads as not found.
 */
export const Route = createFileRoute("/_storefront/rentals/$number")({
  head: ({ params }) => ({
    meta: [{ title: `Rental ${params.number} — Async` }, { name: "robots", content: "noindex" }],
  }),
  component: RentalPage,
});

function RentalPage() {
  const { number: param } = Route.useParams();
  const number = rentalNumberSchema.safeParse(param).success ? param : undefined;
  const { isLoaded, isSignedIn } = useAuth();
  const rental = useMyRental(number);

  if (isLoaded && !isSignedIn) {
    return (
      <SignInPrompt title="Sign in to see this rental">
        Your rentals are saved to your account. Sign in with the account you checked out with.
      </SignInPrompt>
    );
  }
  if (!number) return <RentalNotFound />;
  if (rental.isPending) return <RentalSkeleton />;
  if (rental.isError) {
    return (
      <ReturnError
        title="We couldn't load this rental"
        error={rental.error}
        onRetry={() => void rental.refetch()}
        isRetrying={rental.isFetching}
      />
    );
  }
  if (!rental.data) return <RentalNotFound />;

  return <RentalOverview rental={rental.data} />;
}

function RentalNotFound() {
  return (
    <ReturnMessage
      title="We couldn't find that rental"
      actions={
        <Link to="/rentals" className={buttonVariants({ variant: "outline" })}>
          See my rentals
        </Link>
      }
    >
      Check the number, or open it from your rentals. It may belong to another account.
    </ReturnMessage>
  );
}
