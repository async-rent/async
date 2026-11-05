import { maxCartLineQuantity, type Cart, type CartItem } from "@async-rent/core";
import { Button, buttonVariants } from "@async-rent/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@async-rent/ui/components/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@async-rent/ui/components/popover";
import { Separator } from "@async-rent/ui/components/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@async-rent/ui/components/sheet";
import { Skeleton } from "@async-rent/ui/components/skeleton";
import { Spinner } from "@async-rent/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@async-rent/ui/components/toggle-group";
import { SignInButton } from "@clerk/tanstack-react-start";
import {
  RiArrowRightLine,
  RiCloseLine,
  RiLockLine,
  RiSubtractLine,
  RiAddLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";

import { cartUnitCount, useCart, useCartActions } from "../../hooks/use-cart";
import { useRentalPlan } from "../../hooks/use-rental-plan";
import { catalogOverviewQueryOptions } from "../../hooks/use-catalog-overview";
import { cityLabel } from "../../lib/cities";
import { formatMoney } from "../../lib/money";
import { formatDeliveryDate, rentalWeekOptions } from "../../lib/rental-plan";
import { CityPicker } from "../city-picker";
import { DeliveryCalendar } from "../delivery-date-picker";
import { ProductImage } from "../product-image";
import { useCartDrawer } from "./cart-drawer-context";

const eyebrow = "font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase";

/**
 * The slide-in cart: what the visitor holds in their city, where and when it
 * arrives, how long they plan to rent, and what a week costs.
 */
export function CartDrawer() {
  const { open, setOpen } = useCartDrawer();
  const { cart, isSignedIn, isLoading } = useCart();
  const { location } = useRentalPlan();

  const units = cartUnitCount(cart);
  const hasItems = units > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-110"
      >
        <SheetHeader className="flex-row items-start justify-between gap-4 px-7 pt-6.5 pb-5">
          <div className="flex flex-col gap-1">
            <p className={eyebrow}>Your cart</p>
            <SheetTitle className="font-heading text-3xl leading-none font-normal tracking-[-0.02em]">
              {units === 1 ? "1 item" : `${units} items`}
            </SheetTitle>
            <SheetDescription className="pt-0.5 text-xs">
              Renting in {cityLabel(location)}
            </SheetDescription>
          </div>
          <SheetClose
            render={
              <Button variant="outline" size="icon-sm" className="rounded-full shadow-none" />
            }
          >
            <RiCloseLine />
            <span className="sr-only">Close cart</span>
          </SheetClose>
        </SheetHeader>

        <DeliveryStrip />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isLoading && isSignedIn ? (
            <CartLinesSkeleton />
          ) : !isSignedIn ? (
            <SignedOutState />
          ) : hasItems && cart ? (
            <>
              <ul className="flex flex-col px-7">
                {cart.items.map((item) => (
                  <CartLine key={item.productId} item={item} currency={cart.currency} />
                ))}
              </ul>
              <RentalLength />
            </>
          ) : (
            <EmptyCartState />
          )}
        </div>

        {hasItems && cart && <CartTotals cart={cart} />}
      </SheetContent>
    </Sheet>
  );
}

function DeliveryStrip() {
  const { location, plan } = useRentalPlan();
  const [changing, setChanging] = useState(false);

  return (
    <div className="flex h-13.5 shrink-0 items-center justify-between gap-4 border-y bg-fog px-7">
      <div className="flex min-w-0 flex-col gap-0.75">
        <p className="font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase">
          Delivering to
        </p>
        <p className="truncate text-[12.5px] leading-4">
          {cityLabel(location)} · {formatDeliveryDate(plan.deliveryDate)}
        </p>
      </div>
      <Popover open={changing} onOpenChange={setChanging}>
        <PopoverTrigger
          render={
            <Button variant="link" size="xs" className="px-0 text-foreground underline">
              Change
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto gap-3 p-3">
          <p className={eyebrow}>Deliver to</p>
          <CityPicker className="w-full justify-between rounded-md border-input" />
          <Separator />
          <p className={eyebrow}>Delivery day</p>
          <DeliveryCalendar onPicked={() => setChanging(false)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface CartLineProps {
  item: CartItem;
  currency: string;
}

function CartLine({ item, currency }: CartLineProps) {
  const { setQuantity, updatingProductId } = useCartActions();
  const { location } = useRentalPlan();
  // Cart lines carry no tagline; the catalog overview of the city has one per product.
  const { data: overview } = useQuery(catalogOverviewQueryOptions(location.id));
  const summary = overview?.productSummaries[item.productId];
  const busy = updatingProductId === item.productId;

  const change = (quantity: number) => setQuantity({ productId: item.productId, quantity });

  return (
    <li className="flex gap-4 border-b py-4.5">
      <ProductImage
        image={item.images[0]}
        className="size-19 shrink-0 rounded-md"
        imageClassName="size-16.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <p className="text-[13.5px] leading-[1.2]">{item.name}</p>
        {summary && (
          <p className="truncate font-mono text-[10px] leading-3 tracking-[0.04em] text-muted-foreground uppercase">
            {summary}
          </p>
        )}
        {!item.available && (
          <p className="text-xs text-destructive">Not available in {location.name} right now</p>
        )}
        <div className="flex items-center gap-3.5 pt-2">
          <div className="flex h-6 w-18 items-center justify-between rounded-sm border">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`One less ${item.name}`}
              disabled={busy || item.quantity <= 1}
              onClick={() => change(item.quantity - 1)}
            >
              <RiSubtractLine />
            </Button>
            <span className="font-mono text-[10px] leading-3" aria-live="polite">
              {busy ? <Spinner className="size-3" /> : item.quantity}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`One more ${item.name}`}
              disabled={busy || item.quantity >= maxCartLineQuantity}
              onClick={() => change(item.quantity + 1)}
            >
              <RiAddLine />
            </Button>
          </div>
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 text-[10.5px] text-muted-foreground underline"
            disabled={busy}
            onClick={() => change(0)}
          >
            Remove
          </Button>
        </div>
      </div>
      <div className="flex w-14 shrink-0 flex-col items-end gap-0.75 pt-0.5">
        <p className="font-mono text-[13px] leading-4">
          {formatMoney(item.weeklyPrice * item.quantity, currency)}
        </p>
        <p className="font-mono text-[9px] leading-3 tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase">
          Per week
        </p>
      </div>
    </li>
  );
}

function RentalLength() {
  const { plan, setWeeks } = useRentalPlan();

  return (
    <div className="flex shrink-0 flex-col gap-2 px-7 pt-5 pb-5.5">
      <div className="flex items-center justify-between gap-4">
        <p
          id="rental-length"
          className="font-mono text-[9.5px] tracking-[0.12em] text-muted-foreground uppercase"
        >
          Rental length
        </p>
        <p className="text-[10.5px] text-muted-foreground">Cancel or swap after week one</p>
      </div>
      <ToggleGroup
        aria-labelledby="rental-length"
        variant="outline"
        spacing={0}
        className="w-full bg-fog"
        value={[String(plan.weeks)]}
        onValueChange={(value) => {
          const weeks = rentalWeekOptions.find((option) => String(option) === value[0]);
          if (weeks) setWeeks(weeks);
        }}
      >
        {rentalWeekOptions.map((weeks) => (
          <ToggleGroupItem
            key={weeks}
            value={String(weeks)}
            size="sm"
            className="flex-1 text-xs font-normal aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {weeks === 1 ? "1 week" : `${weeks} weeks`}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-[10.5px] text-muted-foreground">Billed weekly. No lock-in.</p>
    </div>
  );
}

function CartTotals({ cart }: { cart: Cart }) {
  const { setOpen } = useCartDrawer();
  const { summary, currency } = cart;
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <SheetFooter className="mt-0 shrink-0 gap-0 border-t p-0">
      <dl className="flex flex-col gap-1.5 px-7 pt-4 pb-3.5 text-[11.5px]">
        <div className="flex h-4.5 items-center justify-between">
          <dt className="text-muted-foreground">Rent subtotal</dt>
          <dd className="font-mono">{money(summary.weeklySubtotal)}</dd>
        </div>
        <div className="flex h-4.5 items-center justify-between">
          <dt className="text-muted-foreground">Delivery &amp; setup</dt>
          <dd className={summary.deliveryFee > 0 ? "font-mono" : undefined}>
            {summary.deliveryFee > 0 ? money(summary.deliveryFee) : "Free"}
          </dd>
        </div>
        {summary.discount > 0 && (
          <div className="flex h-4.5 items-center justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="font-mono">−{money(summary.discount)}</dd>
          </div>
        )}
        <Separator className="mt-2 mb-1" />
        <div className="flex items-baseline justify-between">
          <dt className="text-[13px]">Total / week</dt>
          <dd className="font-mono text-lg leading-5.5 tracking-[-0.02em]">
            {money(summary.weeklySubtotal)}
          </dd>
        </div>
        <p className="text-[10px] leading-3 text-muted-foreground">
          Deposit {money(summary.deposit)} · {money(summary.totalDueToday)} due at checkout with the
          first week{summary.deliveryFee > 0 ? " and delivery" : ""}.
        </p>
      </dl>
      <div className="flex flex-col gap-2.5 px-7 pt-3.5 pb-6">
        <Link
          to="/checkout"
          // Checkout can open the drawer too, so close it on the way there.
          onClick={() => setOpen(false)}
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-13 justify-between px-5 text-[13.5px] font-normal",
          )}
        >
          Continue to checkout
          <RiArrowRightLine data-icon="inline-end" />
        </Link>
        <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <RiLockLine className="size-3" />
          {summary.deposit > 0 ? "Refundable deposit" : "No deposit"} · You can cancel anytime
        </p>
      </div>
    </SheetFooter>
  );
}

function CartLinesSkeleton() {
  return (
    <div className="flex flex-col px-7" aria-busy="true" aria-label="Loading your cart">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-4 border-b py-4.5">
          <Skeleton className="size-19 rounded-md" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCartState() {
  const { setOpen } = useCartDrawer();

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-xl font-normal">Your cart is empty</EmptyTitle>
        <EmptyDescription>
          Add a desk, a chair or a whole setup to see what a week costs.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Browse equipment
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function SignedOutState() {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-xl font-normal">
          Sign in to start a cart
        </EmptyTitle>
        <EmptyDescription>
          Your cart is saved to your account, so it follows you to checkout.
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
