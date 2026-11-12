import { AppDocument, documentHead } from "@repo/shell/app-document";
import { ThemeProvider } from "@repo/ui/blocks/theme";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => documentHead("Admin - Tagaroa", appCss),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppDocument app="apps/admin">
      {children}
      <Scripts />
    </AppDocument>
  );
}
