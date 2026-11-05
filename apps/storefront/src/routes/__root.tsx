import { Toaster } from "@async-rent/ui/components/toast";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { CartDrawer } from "../components/cart/cart-drawer";
import { CartDrawerProvider } from "../components/cart/cart-drawer-context";
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
  loader: ({ context: { queryClient } }) =>
    queryClient.query({ ...storefrontQueryOptions, staleTime: "static" }),
  shellComponent: RootDocument,
  component: RootLayout,
});

// Each section brings its own header: the shop pages the full one, checkout a
// focused one. The cart drawer stays here so both can open it.
function RootLayout() {
  return (
    <CartDrawerProvider>
      <Outlet />
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
