import { Button } from "@repo/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AnyRoute, createRouter, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * What a route shows when it could not load: the core service gave no answer,
 * or the page broke. Admission never guesses, so this is where an outage lands.
 */
function RouteError() {
  const router = useRouter();
  return (
    <div className="flex min-h-svh">
      <Empty>
        <EmptyHeader>
          <EmptyTitle aria-level={1} role="heading">
            This page didn't load
          </EmptyTitle>
          <EmptyDescription>
            Tagaroa didn't answer, or something on the page broke. Nothing was
            changed.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => void router.invalidate()}>Try again</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

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
    defaultErrorComponent: RouteError,
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
