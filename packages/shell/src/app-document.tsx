import { themeBootScript } from "@repo/ui/blocks/theme";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { impeccableBridgeTool } from "./devtools/impeccable-bridge";
import { InternalDevtools } from "./devtools/internal-devtools";
import {
  INSPECT_HOTKEY,
  SourceInspectorBridge,
} from "./devtools/source-inspector";

/** The `head` every workspace app's root route declares. */
export const documentHead = (title: string, stylesheet: string) => ({
  meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "color-scheme", content: "light dark" },
    { title },
  ],
  links: [{ rel: "stylesheet", href: stylesheet }],
});

const inspectorSettings = `
  try {
    const key = "tanstack_devtools_settings";
    const settings = JSON.parse(localStorage.getItem(key) || "{}");
    settings.inspectHotkey = ${JSON.stringify(INSPECT_HOTKEY)};
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {}
`;

function DeveloperTools({ app }: { app: string }) {
  return (
    <>
      <SourceInspectorBridge />
      <InternalDevtools tools={[impeccableBridgeTool(app)]} />
      <aside aria-labelledby="developer-tools-heading">
        <h2 className="sr-only" id="developer-tools-heading">
          Developer tools
        </h2>
        <TanStackDevtools
          config={{ inspectHotkey: [...INSPECT_HOTKEY] }}
          plugins={[
            { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </aside>
    </>
  );
}

/**
 * The document every workspace app renders: theme set before first paint, and
 * in development the inspector and devtools. `children` ends with the app's
 * `<Scripts />`, which stays in `__root.tsx` because `scripts/with-live.mjs`
 * injects before it there.
 *
 * `app` is the workspace path the Impeccable bridge reports, like `apps/admin`.
 */
export function AppDocument({
  app,
  children,
}: Readonly<{ app: string; children: ReactNode }>) {
  return (
    // The head script sets the theme class before React hydrates, which is
    // the whole point of it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // eslint-disable-next-line react/no-danger -- sets the theme class before first paint
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body>
        {import.meta.env.DEV && (
          <script dangerouslySetInnerHTML={{ __html: inspectorSettings }} />
        )}
        {children}
        {import.meta.env.DEV && <DeveloperTools app={app} />}
      </body>
    </html>
  );
}
