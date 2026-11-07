import { Badge } from "@async-rent/ui/components/badge";
import { Button } from "@async-rent/ui/components/button";
import { Show, SignInButton, UserButton } from "@clerk/tanstack-react-start";
import { RiShoppingCart2Line, RiUser3Line } from "@remixicon/react";
import { Link } from "@tanstack/react-router";

import { cartUnitCount, useCart } from "../hooks/use-cart";
import { AudienceSwitch } from "./audience-switch";
import { useCartDrawer } from "./cart/cart-drawer-context";
import { CityPicker } from "./city-picker";
import { Logo } from "./logo";

export function SiteHeader() {
  const { cart } = useCart();
  const { setOpen } = useCartDrawer();
  const cartCount = cartUnitCount(cart);

  return (
    <header className="border-b bg-paper">
      <div className="mx-auto flex w-full max-w-360 items-center justify-between gap-3 px-5 py-6 sm:gap-8 md:px-10 xl:px-20">
        <div className="flex shrink-0 items-center gap-8">
          <Link to="/" aria-label="Async home" className="text-ink">
            <Logo className="h-9 w-auto" />
          </Link>
          <span className="hidden text-sm text-ink sm:inline">How it works</span>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-4.5">
          <AudienceSwitch />
          {/* Long city names truncate on narrow screens instead of pushing the page sideways. */}
          <CityPicker className="min-w-0" />
          <span
            className="hidden font-mono text-[11px] tracking-[0.04em] text-ink sm:inline"
            aria-label="Prices in US dollars"
          >
            USD
          </span>
          <Button
            variant="outline"
            size="icon-lg"
            className="relative rounded-full shadow-none"
            onClick={() => setOpen(true)}
            aria-label={
              cartCount > 0 ? `Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}` : "Cart"
            }
          >
            <RiShoppingCart2Line />
            {cartCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4.25 min-w-4.25 border-2 border-paper px-1 font-mono text-[8px] leading-2.5">
                {cartCount}
              </Badge>
            )}
          </Button>
          <AccountEntry />
        </div>
      </div>
    </header>
  );
}

function AccountEntry() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full shadow-none"
            aria-label="Sign in"
          >
            <RiUser3Line />
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="flex size-10 items-center justify-center">
          <UserButton />
        </div>
      </Show>
    </>
  );
}
