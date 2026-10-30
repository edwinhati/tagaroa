import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Non-zero so a freshly hydrated route doesn't refetch what its loader
      // just put in the cache.
      queries: { staleTime: 60_000 },
    },
  });

  return createRouter({
    routeTree,
    // The proxy mounts this app under /engineering; every route it knows about
    // is relative to that, and `vite.config.ts` carries the same prefix for
    // assets.
    basepath: "/engineering",
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}
