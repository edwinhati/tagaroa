import { AppTrail, Page } from "@repo/shell/app-shell";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/")({
  component: Home,
});

function Home() {
  const { domains } = Route.useRouteContext();
  const live = domains.filter((domain) => domain.live).length;

  return (
    <Page
      breadcrumb={<AppTrail items={[{ label: "Workspace" }]} />}
      title="Home"
    >
      <div className="p-5 max-w-[36rem] overflow-hidden rounded-[var(--panel-radius)] border border-border bg-card shadow-[var(--panel-shadow)]">
        {domains.length === 0 ? (
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            No work areas are assigned to you yet. Ask your administrator to add
            you to a team.
          </p>
        ) : live < domains.length ? (
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            {live === 0
              ? "Your work areas are not available yet."
              : "Some of your work areas are not available yet."}{" "}
            Available areas open from the sidebar.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
            Choose a work area from the sidebar to continue.
          </p>
        )}
      </div>
    </Page>
  );
}
