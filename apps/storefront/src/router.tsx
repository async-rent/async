import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { getContext as getTanStackQueryContext } from "./integrations/tanstack-query/context";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const tanStackQueryContext = getTanStackQueryContext();

  const context = { ...tanStackQueryContext };

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  setupRouterSsrQueryIntegration({ router, queryClient: tanStackQueryContext.queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
