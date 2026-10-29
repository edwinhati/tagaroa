import { AppShell } from "@repo/shell/app-shell";
import { admitAdmin, operatorOf, WORKSPACE_URL } from "@repo/shell/session";
import { Toaster } from "@repo/ui/components/toast";
import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import {
  AdminContextNav,
  AdminMobileNav,
  adminContextTitle,
  adminGroupKey,
  adminGroups,
} from "../components/admin-nav";

/**
 * Admission for the whole surface, decided once. `ssr: false` for the same
 * reason as every other workspace app: the session is a cookie for the core
 * service, an origin this app's server never sees.
 */
export const Route = createFileRoute("/_shell")({
  ssr: false,
  beforeLoad: async ({ context }) => ({
    session: await admitAdmin(context.queryClient),
  }),
  component: Shell,
});

function Shell() {
  const { session } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const groupKey = adminGroupKey(pathname);

  return (
    // Every action here changes someone else's access, and better-auth resolves
    // failures rather than throwing them — so each one says out loud whether it
    // happened. Without this a refused ban looks exactly like a granted one.
    <Toaster>
      <AppShell
        activeGroupKey={groupKey}
        brandHref={WORKSPACE_URL}
        brandMark="Admin"
        contentId="admin-content"
        contextTitle={adminContextTitle(groupKey)}
        groups={adminGroups}
        operator={operatorOf(session)}
        renderContextNav={(ctx) => (
          <AdminContextNav {...ctx} groupKey={groupKey} />
        )}
        renderMobileNav={(ctx) => <AdminMobileNav {...ctx} />}
      >
        <Outlet />
      </AppShell>
    </Toaster>
  );
}
