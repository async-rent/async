import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

/** The shopping pages: the full Async header and footer around the page. */
export const Route = createFileRoute("/_storefront")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
