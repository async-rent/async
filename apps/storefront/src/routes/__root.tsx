import { Toaster } from "@async-rent/ui/components/toast";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { CartDrawer } from "../components/cart/cart-drawer";
import { CartDrawerProvider } from "../components/cart/cart-drawer-context";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { storefrontQueryOptions } from "../hooks/use-rental-plan";
import ClerkProvider from "../integrations/clerk/provider";

import TanStackRouterDevtools from "../integrations/tanstack-router/devtools";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface AppContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<AppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Async — Rent Your Workspace",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/x-icon",
        href: "/favicon.ico",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  // Cities and the visitor's rental plan: every page reads them through useRentalPlan.
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(storefrontQueryOptions),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  return (
    <CartDrawerProvider>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <CartDrawer />
    </CartDrawerProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider>
          <Toaster>{children}</Toaster>
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[TanStackRouterDevtools, TanStackQueryDevtools]}
          />
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
