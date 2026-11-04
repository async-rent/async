import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
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
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider>
          <div className="flex min-h-svh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
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
