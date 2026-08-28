import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { ThemeProvider, themeBootScript } from "../components/theme";

import appCss from "../styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "Tagaroa" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
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

// suppressHydrationWarning on <html>: the head script sets the theme class before
// React hydrates, which is the whole point of it.
function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // eslint-disable-next-line react/no-danger -- sets the theme class before first paint
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body>
        {/* Direction contract — emitted into the built markup on purpose. */}
        <div
          data-impeccable-contract=""
          dangerouslySetInnerHTML={{
            __html:
              "<!--\n  THESIS: This is a door, not a destination — the fastest legible way from\n  an invitation link into the workspace. Refuses the centered card on\n  gray, and refuses branding a credential screen.\n  OWN-WORLD: Two flat bordered panels on a neutral ground — one holds the form,\n  one holds a live WebGL water surface. Small controls, one display line.\n  STORY: A staff member arrives from an invite or a redirect, sees whose\n  workspace this is and on what terms access works, signs in, leaves.\n  FIRST VIEWPORT: full-width header, then two columns — a 21rem stack of display\n  line, sentence and panelled form on the left, an inset rounded panel of moving\n  water on the right. The primary action sits full-width under the last field.\n  FORM: Claude's sign-in composition, with the water where its photograph goes.\n  FINISH: unreviewed and undocumented is unfinished; this build ends with\n  the finish review, the verdict, DESIGN.md, and every shipping raster\n  carrying its provenance.\n-->",
          }}
        />
        {children}
        {import.meta.env.DEV && (
          <TanStackDevtools
            plugins={[
              {
                name: "TanStack Query",
                render: <ReactQueryDevtoolsPanel />,
              },
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  );
}
