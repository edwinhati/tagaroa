import { impeccableBridgeTool } from "@repo/ui/blocks/impeccable-bridge";
import { InternalDevtools } from "@repo/ui/blocks/internal-devtools";
import { SourceInspectorBridge } from "@repo/ui/blocks/source-inspector";
import { ThemeProvider, themeBootScript } from "@repo/ui/blocks/theme";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

const sourceInspectorSettings = (
  <script>{`
  try {
    const key = "tanstack_devtools_settings";
    const settings = JSON.parse(localStorage.getItem(key) || "{}");
    settings.inspectHotkey = ["Alt", "Shift"];
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {}
`}</script>
);

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
      <ClientOnly>
        <Outlet />
      </ClientOnly>
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
        {import.meta.env.DEV && sourceInspectorSettings}
        {/* Direction contract — emitted into the built markup on purpose. */}
        <div
          data-impeccable-contract=""
          dangerouslySetInnerHTML={{
            __html:
              "<!--\n  THESIS: This is a door, not a destination — the fastest legible way from\n  an invitation link into the workspace. Refuses the centered card on\n  gray, and refuses branding a credential screen.\n  OWN-WORLD: Two flat bordered panels on a neutral ground — one holds the form,\n  one holds a quiet CSS tide. Small controls, one display line.\n  STORY: A staff member arrives from an invite or a redirect, sees whose\n  workspace this is and on what terms access works, signs in, leaves.\n  FIRST VIEWPORT: full-width header, then two columns — a 21rem stack of display\n  line, sentence and panelled form on the left, an inset rounded panel of slow\n  layered currents on the right. The primary action sits full-width under the\n  last field.\n  FORM: Claude's sign-in composition, with the tide where its photograph goes.\n  FINISH: unreviewed and undocumented is unfinished; this build ends with\n  the finish review, the verdict, DESIGN.md, and every shipping raster\n  carrying its provenance.\n-->",
          }}
        />
        {children}
        {import.meta.env.DEV && <SourceInspectorBridge />}
        {import.meta.env.DEV && (
          <InternalDevtools tools={[impeccableBridgeTool("apps/auth")]} />
        )}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ inspectHotkey: ["Alt", "Shift"] }}
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
