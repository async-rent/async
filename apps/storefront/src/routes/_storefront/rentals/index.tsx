import { useAuth } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

import { ReturnError } from "../../../components/checkout/payment-return";
import {
  NoRentals,
  PastLastPage,
  RentalsList,
  RentalsListSkeleton,
} from "../../../components/rentals/rentals-list";
import { rentalPageClass } from "../../../components/rentals/rental-overview";
import { SignInPrompt } from "../../../components/rentals/sign-in-prompt";
import { useMyRentals } from "../../../hooks/use-my-rentals";
import { myRentalsSearchSchema } from "../../../lib/rentals";

/** The signed-in customer's rentals, newest first. */
export const Route = createFileRoute("/_storefront/rentals/")({
  validateSearch: myRentalsSearchSchema,
  head: () => ({
    meta: [{ title: "My rentals — Async" }, { name: "robots", content: "noindex" }],
  }),
  component: MyRentalsPage,
});

function MyRentalsPage() {
  const { page = 1 } = Route.useSearch();
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && !isSignedIn) {
    return (
      <SignInPrompt title="Sign in to see your rentals">
        Your rentals are saved to your account. Sign in with the account you checked out with.
      </SignInPrompt>
    );
  }

  return (
    <div className={rentalPageClass}>
      <div className="flex flex-col gap-4 pb-10">
        <h1 className="font-heading text-[40px] leading-none font-normal tracking-[-0.02em] sm:text-[44px]">
          My rentals
        </h1>
        <p className="max-w-120 text-sm leading-normal text-muted-foreground">
          Every rental on your account, newest first. Open one for its delivery, payments and weekly
          billing.
        </p>
      </div>
      <RentalsPageBody page={page} />
    </div>
  );
}

function RentalsPageBody({ page }: { page: number }) {
  const rentals = useMyRentals(page);

  if (rentals.isPending) return <RentalsListSkeleton />;
  if (rentals.isError) {
    return (
      <ReturnError
        title="We couldn't load your rentals"
        error={rentals.error}
        onRetry={() => void rentals.refetch()}
        isRetrying={rentals.isFetching}
      />
    );
  }

  const { data } = rentals;
  if (data.total === 0) return <NoRentals />;
  if (data.items.length === 0) return <PastLastPage />;
  return <RentalsList page={data} />;
}
