import { AppShell } from "@repo/shell/app-shell";
import {
  ADMIN_URL,
  admit,
  isImpersonating,
  operatorOf,
  WORKSPACE_URL,
} from "@repo/shell/session";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";

import { AccountSettingsDialog } from "../components/account-settings";
import {
  WorkspaceContextNav,
  WorkspaceMobileNav,
  workspaceGroups,
} from "../components/workspace-nav";

/**
 * Everything the shell shows sits under this layout, so admission is decided
 * once. `ssr: false` is what makes that decision the client's: the session is a
 * cookie for the core service, another origin this app's server never sees.
 */
export const Route = createFileRoute("/_shell")({
  ssr: false,
  beforeLoad: ({ context }) => admit(context.queryClient),
  component: Shell,
});
// TanStack Start deletes `ssr` from the client's copy of the options above, so
// the loaded match drops the client-only boundary the server streamed. A load
// that settles before React hydrates that boundary is a hydration mismatch.
Route.options.ssr = false;

function Shell() {
  const { admin, domains, session } = Route.useRouteContext();
  const [accountOpen, setAccountOpen] = useState(false);
  const user = session?.user;
  const name = user?.name?.trim() || user?.email || "Account";
  const email = user?.email ?? "";

  return (
    <>
      <AppShell
        activeGroupKey="home"
        adminHref={admin ? `${ADMIN_URL}/overview` : undefined}
        brandHref={WORKSPACE_URL}
        contentId="workspace-content"
        contextTitle="Workspace"
        groups={workspaceGroups}
        impersonating={isImpersonating(session)}
        onAccountSettings={() => setAccountOpen(true)}
        operator={operatorOf(session)}
        renderContextNav={(ctx) => (
          <WorkspaceContextNav domains={domains} onNavigate={ctx.onNavigate} />
        )}
        renderMobileNav={(ctx) => (
          <WorkspaceMobileNav domains={domains} onNavigate={ctx.onNavigate} />
        )}
      >
        <Outlet />
      </AppShell>
      <AccountSettingsDialog
        email={email}
        name={name}
        onOpenChange={setAccountOpen}
        open={accountOpen}
        twoFactorEnabled={Boolean(user?.twoFactorEnabled)}
      />
    </>
  );
}
