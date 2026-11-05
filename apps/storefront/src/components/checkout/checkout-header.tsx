import { Button } from "@async-rent/ui/components/button";
import { Separator } from "@async-rent/ui/components/separator";
import { RiArrowLeftLine, RiLockLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { supportEmail } from "../../lib/checkout";
import { useCartDrawer } from "../cart/cart-drawer-context";
import { Logo } from "../logo";

const label = "font-mono text-[10px] tracking-[0.12em] uppercase";

/** Checkout's own header: the way back to the cart, and help, with nothing else to wander off to. */
export function CheckoutHeader() {
  const { setOpen } = useCartDrawer();

  return (
    <header className="border-b bg-paper">
      <div className="mx-auto flex w-full max-w-360 items-center justify-between gap-4 px-5 py-6 md:px-10 xl:px-20">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link to="/" aria-label="Async home" className="shrink-0 text-ink">
            <Logo className="h-9 w-auto" />
          </Link>
          <Separator orientation="vertical" className="h-5 self-center" />
          <Button
            variant="ghost"
            size="xs"
            className={cn(label, "px-1.5 font-normal text-muted-foreground")}
            onClick={() => setOpen(true)}
          >
            <RiArrowLeftLine data-icon="inline-start" />
            Back to cart
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <p className={cn(label, "hidden items-center gap-1.5 text-muted-foreground sm:flex")}>
            <RiLockLine className="size-3" />
            Secure checkout
          </p>
          <a
            href={`mailto:${supportEmail}`}
            className="text-xs text-ink underline underline-offset-3 hover:text-primary"
          >
            Need help?
          </a>
        </div>
      </div>
    </header>
  );
}
