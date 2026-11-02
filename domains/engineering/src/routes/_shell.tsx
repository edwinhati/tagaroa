import { admit, isImpersonating, operatorOf } from "@repo/shell/session";
import { WorkspaceShell } from "@repo/shell/shell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * The same chrome the shell app wears, with this domain marked current — a
 * person moving from the workspace into engineering crosses an app boundary and
 * should not be able to tell. Admission is decided here too: this app answers on
 * its own port as well as through the proxy.
 */
export const Route = createFileRoute("/_shell")({
  ssr: false,
  beforeLoad: ({ context }) => admit(context.queryClient, "engineering"),
  component: Shell,
});
// TanStack Start deletes `ssr` from the client's copy of the options above, so
// the loaded match drops the client-only boundary the server streamed. A load
// that settles before React hydrates that boundary is a hydration mismatch.
Route.options.ssr = false;

function Shell() {
  const { admin, domains, session } = Route.useRouteContext();

  return (
    <WorkspaceShell
      admin={admin}
      current="engineering"
      domains={domains}
      impersonating={isImpersonating(session)}
      operator={operatorOf(session)}
    >
      <Outlet />
    </WorkspaceShell>
  );
}
