import { primaryRoleLabel } from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import type { AuthSession } from "@repo/shell/create-auth-client";
import { parseUserAgent } from "@repo/shell/session-device";
import { SessionDeviceMarks } from "@repo/shell/session-device-mark";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { relativeTime } from "@repo/ui/lib/relative-time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EllipsisIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  Mark,
  FIGURE,
  MONO,
  PANEL,
  COLLECTION,
  Nothing,
  SECTION,
  SurfaceBanner,
} from "../../../components/admin-surface";
import { IdentitySecurityOperations } from "../../../components/identity-security-operations";
import {
  ACTION_LABELS,
  DESTRUCTIVE,
  type PersonAction,
  PersonActionItems,
  type PersonAdmin,
  PositionDialog,
  PositionSummary,
  usePersonAdmin,
} from "../../../components/person-admin";
import type {
  BusinessAssignment,
  Directory,
  PeopleSearch,
  Person,
} from "../../../lib/admin";
import {
  accessPolicyQueryOptions,
  announce,
  businessAccessPolicyQueryOptions,
  businessAssignmentsQueryOptions,
  dashboardQueryOptions,
  directoryQueryOptions,
  everyPersonQueryOptions,
  linkedAccountsQueryOptions,
  personQueryOptions,
  personSessionsQueryOptions,
  revokeSession,
  standingOf,
} from "../../../lib/admin";
import { attentionCopy, eventAction } from "../../../lib/identity-operations";

export const Route = createFileRoute(
  "/_shell/identity-access/people/$personId",
)({
  component: PersonRoute,
});

function PersonRoute() {
  const { personId } = Route.useParams();
  const search = Route.useSearch();

  return <PersonWorkspace personId={personId} search={search} />;
}

function PersonWorkspace({
  personId,
  search,
}: {
  personId: string;
  search: PeopleSearch;
}) {
  const person = useQuery(personQueryOptions(personId));

  if (person.isPending) return <PersonWorkspaceSkeleton />;
  if (person.isError || !person.data) {
    return (
      <Page
        breadcrumb={
          <AppTrail
            items={[
              {
                label: "People",
                search: search as Record<string, unknown>,
                to: "/identity-access/people",
              },
              { label: "Unavailable" },
            ]}
          />
        }
        title="Account unavailable"
      >
        <Nothing title="Unable to open this account">
          {person.error?.message ?? "The account may no longer exist."}
        </Nothing>
        <div className="mt-4 flex justify-center">
          <Button
            nativeButton={false}
            render={<Link search={search} to="/identity-access/people" />}
            size="sm"
            variant="outline"
          >
            Return to people
          </Button>
        </div>
      </Page>
    );
  }

  return <PersonWorkspaceContent person={person.data} search={search} />;
}

/** The acts kept one step away at the foot of the page. */
const QUICK_ACTIONS: readonly PersonAction[] = [
  "password",
  "sessions",
  "suspend",
  "restore",
];

function PersonWorkspaceContent({
  person,
  search,
}: {
  person: Person;
  search: PeopleSearch;
}) {
  const admin = usePersonAdmin(person);
  const quickActions = QUICK_ACTIONS.filter(admin.offers);

  return (
    <Page
      actions={
        <div className="gap-2 flex items-center">
          {admin.offers("edit") ? (
            <Button onClick={() => admin.request("edit")} size="sm">
              {ACTION_LABELS.edit}
            </Button>
          ) : null}
          <PersonActionMenu admin={admin} person={person} />
        </div>
      }
      breadcrumb={
        <AppTrail
          items={[
            {
              label: "People",
              search: search as Record<string, unknown>,
              to: "/identity-access/people",
            },
            { label: person.name || person.email },
          ]}
        />
      }
      description={
        <span className="gap-x-3 gap-y-1 flex flex-wrap items-center">
          <span className={MONO}>{person.email}</span>
          <Mark
            label={standingOf(person) === "suspended" ? "Suspended" : "Active"}
            tone={standingOf(person) === "suspended" ? "bad" : "done"}
          />
          <span>{primaryRoleLabel(person.role)}</span>
        </span>
      }
      title={person.name || person.email}
    >
      <div className={`${COLLECTION} ${quickActions.length ? "pb-16" : ""}`}>
        {standingOf(person) === "suspended" ||
        !person.emailVerified ||
        person.mustChangePassword ? (
          <SurfaceBanner tone="warn">
            <p>
              <span className="font-medium text-foreground">
                {accountAttentionTitle(person)}
              </span>{" "}
              {accountAttention(person)}
            </p>
          </SurfaceBanner>
        ) : null}

        <IdentitySecurityOperations person={person} />

        <div className="gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] grid items-start">
          <Tabs defaultValue="access">
            <TabsList aria-label="Account sections" variant="line">
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="sign-in">Sign-in</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="access">
              <AccessTab canEdit={admin.offers("edit")} person={person} />
            </TabsContent>
            <TabsContent value="sign-in">
              <SignInTab canRevoke={admin.offers("sessions")} person={person} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab person={person} />
            </TabsContent>
          </Tabs>
          <SignInSummary person={person} />
        </div>
      </div>

      {quickActions.length ? (
        <div className="bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 py-3 sm:px-6 lg:px-8 sticky z-10 border-t border-border/80 bg-background/95">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <p className="text-[12px] text-muted-foreground">
              Dangerous actions stay one step away.
            </p>
            <div className="gap-1.5 flex flex-wrap">
              {quickActions.map((action) => (
                <Button
                  key={action}
                  onClick={() => admin.request(action)}
                  size="sm"
                  type="button"
                  variant={DESTRUCTIVE.has(action) ? "destructive" : "outline"}
                >
                  {ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {admin.dialogs}
    </Page>
  );
}

function AccessTab({ canEdit, person }: { canEdit: boolean; person: Person }) {
  const directory = useQuery(directoryQueryOptions);
  const assignments = useQuery(businessAssignmentsQueryOptions);
  const policy = useQuery(businessAccessPolicyQueryOptions);
  const [editingPosition, setEditingPosition] = useState<
    false | "group" | string
  >(false);
  const people = useQuery({
    ...everyPersonQueryOptions,
    enabled: editingPosition !== false,
  });

  const personAssignments = useMemo(
    () =>
      (assignments.data ?? []).filter(
        (assignment) => assignment.userId === person.id,
      ),
    [assignments.data, person.id],
  );
  const subsidiaries = (directory.data?.subsidiaries ?? []).filter(
    (subsidiary) => subsidiary.memberIds.includes(person.id),
  );
  const teams = (directory.data?.teams ?? []).filter((team) =>
    team.memberIds.includes(person.id),
  );

  return (
    <div className={PANEL}>
      <Row
        action={
          <Button
            nativeButton={false}
            render={<Link to="/subsidiaries" />}
            size="sm"
            variant={subsidiaries.length === 0 ? "default" : "outline"}
          >
            {subsidiaries.length === 0 ? "Add to a team" : "Manage membership"}
          </Button>
        }
        title="Membership"
      >
        {subsidiaries.length === 0 ? (
          <MutedLine>
            No subsidiary or team. Teams decide which domains this person can
            open.
          </MutedLine>
        ) : (
          <ul className="mt-1.5 gap-2 grid">
            {subsidiaries.map((subsidiary) => {
              const subsidiaryTeams = teams.filter(
                (team) => team.organizationId === subsidiary.id,
              );
              return (
                <li className="text-[13px]" key={subsidiary.id}>
                  <p className="font-medium">{subsidiary.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {subsidiaryTeams.length
                      ? subsidiaryTeams.map((team) => team.name).join(", ")
                      : "No team membership"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Row>
      <Row
        action={
          <Button
            nativeButton={false}
            render={<Link to="/identity-access/business-access/assignments" />}
            size="sm"
            variant="outline"
          >
            Review business access
          </Button>
        }
        title="Business access"
      >
        {personAssignments.length === 0 ? (
          <MutedLine>
            No business roles. Access needs both a membership and an assignment.
          </MutedLine>
        ) : (
          <AssignmentSummary
            assignments={personAssignments}
            directory={directory.data}
            roles={policy.data?.roles ?? []}
          />
        )}
      </Row>
      <Row
        action={
          canEdit ? (
            <Button
              onClick={() => setEditingPosition("group")}
              size="sm"
              variant="outline"
            >
              Add or edit position
            </Button>
          ) : null
        }
        title="Position and reporting"
      >
        <MutedLine>
          Titles describe the hierarchy and never grant permissions.
        </MutedLine>
        <div className="mt-2">
          <PositionSummary
            canEdit={canEdit}
            onEdit={setEditingPosition}
            personId={person.id}
            positions={directory.data?.positions ?? []}
            subsidiaries={directory.data?.subsidiaries ?? []}
          />
        </div>
      </Row>

      {editingPosition !== false && directory.data && people.data ? (
        <PositionDialog
          key={editingPosition}
          onOpenChange={(next) => !next && setEditingPosition(false)}
          organizationId={editingPosition === "group" ? null : editingPosition}
          people={people.data}
          person={person}
          positions={directory.data.positions}
          subsidiaries={directory.data.subsidiaries}
        />
      ) : null}
    </div>
  );
}

function SignInTab({
  canRevoke,
  person,
}: {
  canRevoke: boolean;
  person: Person;
}) {
  const queryClient = useQueryClient();
  const sessions = useQuery(personSessionsQueryOptions(person.id));
  const accounts = useQuery(linkedAccountsQueryOptions(person.id));
  const revoke = useMutation({
    mutationFn: revokeSession,
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Session revoked for ${person.email}`);
      void queryClient.invalidateQueries({
        queryKey: personSessionsQueryOptions(person.id).queryKey,
      });
    },
  });

  return (
    <div className={PANEL}>
      <Row
        title="Active sessions"
        trailing={
          sessions.data ? (
            <span className="text-muted-foreground">
              <SessionCount count={sessions.data.length} />
            </span>
          ) : null
        }
      >
        {sessions.isPending ? (
          <div className="mt-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        ) : sessions.isError ? (
          <p className="mt-1.5 text-xs text-destructive">
            {sessions.error.message}
          </p>
        ) : sessions.data.length === 0 ? (
          <MutedLine>No active sessions.</MutedLine>
        ) : (
          <ul className="mt-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
            {sessions.data.map((session) => (
              <SessionCard
                canRevoke={canRevoke}
                key={session.id}
                pending={revoke.isPending}
                session={session}
                onRevoke={() => revoke.mutate(session.id)}
              />
            ))}
          </ul>
        )}
      </Row>
      <Row title="Linked accounts">
        {accounts.isPending ? (
          <Skeleton className="mt-2 h-8" />
        ) : accounts.isError ? (
          <p className="mt-1.5 text-xs text-destructive">
            {accounts.error.message}
          </p>
        ) : accounts.data.length === 0 ? (
          <MutedLine>No linked accounts.</MutedLine>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {accounts.data.map((account) => (
              <li
                className="gap-3 py-1.5 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)_auto] sm:items-baseline grid"
                key={account.id}
              >
                <p className="font-medium text-[13px] capitalize">
                  {account.providerId}
                </p>
                <p className={`${MONO} truncate text-muted-foreground`}>
                  {account.accountId}
                </p>
                <time className={`${FIGURE} text-muted-foreground`}>
                  Linked {new Date(account.createdAt).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </div>
  );
}

function ActivityTab({ person }: { person: Person }) {
  const dashboard = useQuery(dashboardQueryOptions);
  const recentEvents = (dashboard.data?.events ?? [])
    .filter(
      (event) =>
        event.target === person.email ||
        event.target === person.name ||
        event.actor === person.email,
    )
    .slice(0, 6);

  return (
    <div className={PANEL}>
      <Row title="Account">
        <div className="mt-2 gap-4 sm:grid-cols-2 grid">
          <Fact
            label="Created"
            value={new Date(person.createdAt).toLocaleDateString()}
          />
          <Fact label="User ID" mono value={person.id} />
          {person.banned ? (
            <Fact
              label="Suspension reason"
              value={person.banReason || "No reason recorded"}
            />
          ) : null}
        </div>
      </Row>
      <Row
        action={
          <Button
            nativeButton={false}
            render={<Link to="/identity-access/activity" />}
            size="sm"
            variant="ghost"
          >
            View all activity
          </Button>
        }
        title="Recent activity"
      >
        {recentEvents.length === 0 ? (
          <MutedLine>No recent activity for this account.</MutedLine>
        ) : (
          <ul className="mt-1.5 flex flex-col">
            {recentEvents.map((event) => (
              <li
                className="gap-3 py-1.5 flex items-baseline justify-between"
                key={event.id}
              >
                <p className="text-[13px]">{eventAction(event)}</p>
                <time
                  className={`${FIGURE} shrink-0 text-muted-foreground`}
                  dateTime={new Date(event.at).toISOString()}
                >
                  {relativeTime(event.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </div>
  );
}

function SignInSummary({ person }: { person: Person }) {
  const sessions = useQuery(personSessionsQueryOptions(person.id));
  const dashboard = useQuery(dashboardQueryOptions);
  const health = dashboard.data?.people.find(
    (entry) => entry.userId === person.id,
  );

  return (
    <aside aria-label="Sign-in summary" className={`${PANEL} lg:mt-11 px-4`}>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] text-[13px]">
        <SummaryFact label="Two-factor">
          {person.twoFactorEnabled ? "On" : "Not set up"}
        </SummaryFact>
        <SummaryFact label="Password">
          {person.mustChangePassword ? "Temporary" : "Current"}
        </SummaryFact>
        <SummaryFact label="Email">
          {person.emailVerified ? "Verified" : "Not verified"}
        </SummaryFact>
        <SummaryFact label="Sessions">
          {sessions.data ? (
            <SessionCount count={sessions.data.length} />
          ) : sessions.isError ? (
            <span
              className="text-muted-foreground"
              title={sessions.error.message}
            >
              Unavailable
            </span>
          ) : (
            <Skeleton className="h-3.5 w-10" />
          )}
        </SummaryFact>
        <SummaryFact label="Last active">
          <span className={FIGURE}>
            {health?.lastActiveAt ? relativeTime(health.lastActiveAt) : "Never"}
          </span>
        </SummaryFact>
      </dl>
    </aside>
  );
}

/** How many sessions a person holds, against the limit once it is known. */
function SessionCount({ count }: { count: number }) {
  const limit = useQuery(accessPolicyQueryOptions).data?.session
    .concurrentLimit;
  return (
    <span className={FIGURE}>
      {count}
      {limit === undefined ? "" : ` of ${limit}`}
    </span>
  );
}

/** One block of a tab's work surface: title, its content, an optional action. */
function Row({
  action,
  children,
  title,
  trailing,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <section className="gap-3 px-4 py-3.5 sm:flex-row sm:items-start flex flex-col border-t border-border first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="gap-3 flex items-baseline justify-between">
          <h3 className={SECTION}>{title}</h3>
          {trailing}
        </div>
        {children}
      </div>
      {action ? <div className="sm:shrink-0">{action}</div> : null}
    </section>
  );
}

function SummaryFact({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <>
      <dt className="py-2.5 border-t border-border text-muted-foreground first:border-t-0">
        {label}
      </dt>
      <dd className="py-2.5 flex items-center justify-end border-t border-border [dt:first-child+&]:border-t-0">
        {children}
      </dd>
    </>
  );
}

function SessionCard({
  canRevoke,
  onRevoke,
  pending,
  session,
}: {
  canRevoke: boolean;
  onRevoke: () => void;
  pending: boolean;
  session: AuthSession;
}) {
  const parsed = parseUserAgent(session.userAgent);
  const ip = session.ipAddress?.trim() || "Unknown IP";

  return (
    <li className="ease-out flex overflow-hidden rounded-md border border-border/70 bg-muted/20 transition-colors duration-150 hover:bg-muted/35">
      <div className="min-w-0 gap-0.5 px-2.5 py-1.5 flex flex-1 flex-col">
        <div className="gap-1.5 min-w-0 flex items-center">
          <SessionDeviceMarks
            browser={parsed.browser}
            platform={parsed.platform}
          />
          <p
            className="min-w-0 font-medium flex-1 truncate text-[11.5px] leading-none"
            title={session.userAgent || undefined}
          >
            {parsed.label}
          </p>
        </div>
        <p className="leading-snug truncate text-[10.5px] text-muted-foreground">
          <span className="font-mono">{ip}</span>
          <span className="mx-1.5 text-border">·</span>
          <span className={`${FIGURE} text-[10.5px]`}>
            {relativeTime(session.updatedAt)}
          </span>
        </p>
      </div>
      {canRevoke ? (
        <div className="px-1.5 flex items-center justify-center border-l border-border/70 bg-muted/35">
          <Button
            disabled={pending}
            onClick={onRevoke}
            size="xs"
            type="button"
            variant="ghost"
          >
            Revoke
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function PersonActionMenu({
  admin,
  person,
}: {
  admin: PersonAdmin;
  person: Person;
}) {
  // Edit has its own button beside this menu.
  const actions = admin.offered.filter((action) => action !== "edit");
  if (actions.length === 0) return <Mark label="Read only" tone="waiting" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`More actions for ${person.email}`}
            size="icon-sm"
            variant="outline"
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <PersonActionItems actions={actions} admin={admin} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MutedLine({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[12.5px] text-muted-foreground">{children}</p>;
}

function Fact({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-muted-foreground">{label}</p>
      <p
        className={`${mono ? MONO : "text-[13px]"} mt-1 break-words`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function AssignmentSummary({
  assignments,
  directory,
  roles,
}: {
  assignments: BusinessAssignment[];
  directory: Directory | undefined;
  roles: { id: string; name: string }[];
}) {
  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const subsidiaryById = new Map(
    directory?.subsidiaries.map((item) => [item.id, item.name]),
  );
  const teamById = new Map(
    directory?.teams.map((item) => [item.id, item.name]),
  );

  return (
    <ul className="mt-2 gap-0.5 flex flex-col">
      {assignments.slice(0, 5).map((assignment) => (
        <li
          className="row-hover-bg gap-2 py-2 px-2 flex items-start justify-between rounded-md text-[13px]"
          key={assignment.id}
        >
          <div className="min-w-0">
            <p className="font-medium truncate">
              {roleById.get(assignment.roleId) ?? assignment.role.name}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {subsidiaryById.get(assignment.organizationId) ??
                assignment.organizationId}
              {assignment.teamId
                ? ` · ${teamById.get(assignment.teamId) ?? assignment.teamId}`
                : " · all teams"}
            </p>
          </div>
          <Mark
            label={assignment.active ? "Active" : "Inactive"}
            tone={assignment.active ? "done" : "quiet"}
          />
        </li>
      ))}
    </ul>
  );
}

function accountAttentionTitle(person: Person): string {
  if (standingOf(person) === "suspended") return "Sign-in is suspended.";
  if (person.mustChangePassword) return "Still on a temporary password.";
  return "Work email not verified.";
}

function accountAttention(person: Person): string {
  const issues = [
    standingOf(person) === "suspended"
      ? "They cannot sign in until access is restored."
      : null,
    !person.emailVerified
      ? attentionCopy["unverified-email"].consequence
      : null,
    person.mustChangePassword
      ? "They must replace it before reaching the workspace."
      : null,
  ].filter(Boolean);
  return issues.join(" ");
}

function PersonWorkspaceSkeleton() {
  return (
    <Page
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "People" },
          ]}
        />
      }
      description="Reading account details…"
      title="Person"
    >
      <div className={COLLECTION}>
        <Skeleton className="h-20 rounded-[var(--panel-radius)]" />
        <Skeleton className="h-40 rounded-[var(--panel-radius)]" />
        <Skeleton className="h-56 rounded-[var(--panel-radius)]" />
      </div>
    </Page>
  );
}
