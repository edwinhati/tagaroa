import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AnyRoute, createRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Every app's router. No `basepath`: TanStack Start takes it from Vite's
 * `base`, so a domain mounted under a path names it once, in its Vite config.
 */
export function createAppRouter<TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Non-zero so a freshly hydrated route doesn't refetch what its loader
      // just put in the cache.
      queries: { staleTime: 60_000 },
    },
  });

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    Wrap: ({ children }) => {
      // A page being left still runs its reads' failure handlers in some
      // browsers; cancelled, they settle quietly instead of reporting errors.
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
