import { impeccableBridgeTool } from "@repo/ui/blocks/impeccable-bridge";
import { InternalDevtools } from "@repo/ui/blocks/internal-devtools";
import { SourceInspectorBridge } from "@repo/ui/blocks/source-inspector";
import { ThemeProvider, themeBootScript } from "@repo/ui/blocks/theme";
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
      { title: "Engineering — Tagaroa" },
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
        {import.meta.env.DEV && sourceInspectorSettings}
        {children}
        {import.meta.env.DEV && <SourceInspectorBridge />}
        {import.meta.env.DEV && (
          <InternalDevtools
            tools={[impeccableBridgeTool("domains/engineering")]}
          />
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
