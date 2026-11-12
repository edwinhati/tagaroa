import { AppDocument, documentHead } from "@repo/shell/app-document";
import { ThemeProvider } from "@repo/ui/blocks/theme";
import type { QueryClient } from "@tanstack/react-query";
import {
  ClientOnly,
  createRootRouteWithContext,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => documentHead("Tagaroa", appCss),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <ClientOnly>
        <Outlet />
      </ClientOnly>
    </ThemeProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppDocument app="apps/auth">
      {children}
      {/* Direction contract — emitted into the built markup on purpose. */}
      <div
        data-impeccable-contract=""
        dangerouslySetInnerHTML={{
          __html:
            "<!--\n  THESIS: This is a door, not a destination — the fastest legible way from\n  an invitation link into the workspace. Refuses the centered card on\n  gray, and refuses branding a credential screen.\n  OWN-WORLD: Two flat bordered panels on a neutral ground — one holds the form,\n  one holds a quiet CSS tide. Small controls, one display line.\n  STORY: A staff member arrives from an invite or a redirect, sees whose\n  workspace this is and on what terms access works, signs in, leaves.\n  FIRST VIEWPORT: full-width header, then two columns — a 21rem stack of display\n  line, sentence and panelled form on the left, an inset rounded panel of slow\n  layered currents on the right. The primary action sits full-width under the\n  last field.\n  FORM: Claude's sign-in composition, with the tide where its photograph goes.\n  FINISH: unreviewed and undocumented is unfinished; this build ends with\n  the finish review, the verdict, DESIGN.md, and every shipping raster\n  carrying its provenance.\n-->",
        }}
      />
      <Scripts />
    </AppDocument>
  );
}
