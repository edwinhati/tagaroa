import { mayRun } from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { Failed, Nothing } from "../../components/admin-surface";
import {
  CreateSubsidiary,
  CreateTeam,
} from "../../components/subsidiary-forms";
import { TeamList } from "../../components/subsidiary-teams";
import { directoryQueryOptions } from "../../lib/directory";
import { everyPersonQueryOptions } from "../../lib/people";

export const Route = createFileRoute("/_shell/subsidiaries")({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search.id === "string" ? { id: search.id } : {},
  component: Subsidiaries,
});

const shellRoute = getRouteApi("/_shell");

function Subsidiaries() {
  const { id } = Route.useSearch();
  const { session } = shellRoute.useRouteContext();
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);

  const subsidiaries = directory.data?.subsidiaries ?? [];
  // One company at a time: the panel is the list, so the page is the detail.
  // An unscoped visit lands on the first, which the panel marks as current.
  const shown = subsidiaries.find((one) => one.id === id) ?? subsidiaries[0];
  const teams = (directory.data?.teams ?? []).filter(
    (team) => team.organizationId === shown?.id,
  );
  const canManage = mayRun(session?.user?.role, "administer");
  const canCreateSubsidiary = mayRun(session?.user?.role, "superAdmin");

  return (
    <Page
      actions={
        <div className="gap-2 flex">
          {canCreateSubsidiary ? <CreateSubsidiary /> : null}
          {canManage && shown ? <CreateTeam organizationId={shown.id} /> : null}
        </div>
      }
      breadcrumb={
        <AppTrail
          items={
            shown
              ? [
                  { label: "Subsidiaries", to: "/subsidiaries" },
                  { label: shown.name },
                ]
              : [{ label: "Subsidiaries" }]
          }
        />
      }
      description={
        shown
          ? "Team membership decides which domains appear in each workspace."
          : "Operating companies in the group."
      }
      footer={
        shown ? (
          <span className="tabular-nums">
            {teams.length === 1 ? "1 team" : `${teams.length} teams`}
          </span>
        ) : null
      }
      title={shown?.name ?? "Subsidiaries"}
    >
      {directory.isPending ? (
        <div className="gap-3 flex flex-col">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24" />
        </div>
      ) : shown ? (
        <TeamList
          canManage={canManage}
          directory={directory.data}
          organizationId={shown.id}
          people={people.data ?? []}
          subsidiaryMemberIds={shown.memberIds}
        />
      ) : directory.isError ? (
        <Failed
          error={directory.error}
          onRetry={() => void directory.refetch()}
          what="group"
        />
      ) : (
        <Nothing title="No subsidiaries yet">
          {canCreateSubsidiary
            ? "Create the first subsidiary to start adding teams and assigning domain access."
            : "A super administrator must create the first subsidiary before teams and domain access can be managed."}
        </Nothing>
      )}
    </Page>
  );
}
