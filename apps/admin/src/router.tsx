import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { useEffect } from "react";

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
    // No `basepath`: this app owns its whole origin.
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => {
      useEffect(() => {
        const cancelReads = () => {
          void queryClient.cancelQueries();
        };
        window.addEventListener("pagehide", cancelReads);
        return () => window.removeEventListener("pagehide", cancelReads);
      }, []);
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    },
  });
}
