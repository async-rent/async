import { Outlet, createFileRoute } from "@tanstack/react-router";

import { CheckoutHeader } from "../../components/checkout/checkout-header";

/** Checkout and the pages PayPal returns to: a focused header and no footer. */
export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Async" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutLayout,
});

function CheckoutLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <CheckoutHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
