import type { Cart } from "@async-rent/core";
import { Button, buttonVariants } from "@async-rent/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@async-rent/ui/components/empty";
import { Separator } from "@async-rent/ui/components/separator";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { SignInButton, useAuth } from "@clerk/tanstack-react-start";
import { RiCheckLine } from "@remixicon/react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { CheckoutForm } from "../../components/checkout/checkout-form";
import { OrderSummary } from "../../components/checkout/order-summary";
import { useCart } from "../../hooks/use-cart";
import { useCheckout, useCheckoutContact } from "../../hooks/use-checkout";

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});

const formId = "checkout-form";

const pageClass = "mx-auto flex w-full max-w-360 flex-col px-5 pt-8 pb-20 md:px-10 xl:px-20";

function CheckoutPage() {
  const { isLoaded } = useAuth();
  const { cart, isSignedIn, isLoading } = useCart();
  const contact = useCheckoutContact();
  const checkout = useCheckout();

  // Once the order is placed its cart is empty, so the page keeps showing what was ordered.
  const orderCart = checkout.placed?.cart ?? cart;
  const hasItems = orderCart?.items.some((item) => item.available) ?? false;

  if (!isLoaded || (isSignedIn && !checkout.placed && (isLoading || contact.isPending))) {
    return <CheckoutSkeleton />;
  }
  if (!isSignedIn) return <SignedOutCheckout />;
  if (!orderCart || !hasItems) return <EmptyCheckout />;

  return (
    <div className={pageClass}>
      <CheckoutSteps cart={orderCart} />
      <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h1 className="font-heading text-[40px] leading-none font-normal tracking-[-0.02em] sm:text-[44px]">
              Almost there.
            </h1>
            <p className="max-w-105 text-sm leading-normal text-muted-foreground">
              Confirm your details and we'll deliver, assemble, and set up everything within 24
              hours.
            </p>
          </div>
          <CheckoutForm
            id={formId}
            contact={contact.data ?? undefined}
            locked={checkout.placed !== null}
            onSubmit={(details) => checkout.submit({ details, cart: orderCart })}
          />
        </div>
        <OrderSummary
          cart={orderCart}
          formId={formId}
          placedNumber={checkout.placed?.number}
          isSubmitting={checkout.isSubmitting}
          error={checkout.error}
        />
      </div>
    </div>
  );
}

const stepLabel = "font-mono text-[10px] tracking-[0.12em] uppercase";

function CheckoutSteps({ cart }: { cart: Cart }) {
  return (
    <nav aria-label="Checkout steps" className="flex items-center justify-between gap-4">
      <ol className="flex items-center gap-3">
        <li className="flex items-center gap-2 text-muted-foreground">
          <span className="flex size-4 items-center justify-center rounded-full bg-fog text-foreground">
            <RiCheckLine className="size-2.5" />
          </span>
          <span className={stepLabel}>Cart</span>
        </li>
        <li aria-hidden className="w-7">
          <Separator />
        </li>
        <li aria-current="step" className="flex items-center gap-2 text-primary">
          <span className="flex size-4 items-center justify-center rounded-full bg-primary">
            <span className="size-1.5 rounded-full bg-primary-foreground" />
          </span>
          <span className={stepLabel}>Checkout</span>
        </li>
      </ol>
      {cart.summary.deliveryFee === 0 && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          <span className={stepLabel}>Free delivery</span>
        </p>
      )}
    </nav>
  );
}

function CheckoutSkeleton() {
  return (
    <div className={pageClass} aria-busy="true" aria-label="Loading checkout">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-20">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-11 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="mt-6 h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
        <Skeleton className="h-130 rounded-xl" />
      </div>
    </div>
  );
}

function SignedOutCheckout() {
  return (
    <Empty className="min-h-120">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-2xl font-normal">Sign in to check out</EmptyTitle>
        <EmptyDescription>
          Your cart is saved to your account. Sign in to pick it up and place your order.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <SignInButton mode="modal">
          <Button>Sign in</Button>
        </SignInButton>
      </EmptyContent>
    </Empty>
  );
}

function EmptyCheckout() {
  return (
    <Empty className="min-h-120">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-2xl font-normal">Your cart is empty</EmptyTitle>
        <EmptyDescription>
          Add a desk, a chair or a whole setup, then come back here to place your order.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          Browse equipment
        </Link>
      </EmptyContent>
    </Empty>
  );
}
