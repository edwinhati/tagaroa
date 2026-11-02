import { AppTrail, Page } from "@repo/shell/app-shell";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
} from "../../components/admin-surface";
import { IdentitySecurityOperations } from "../../components/identity-security-operations";
import { SessionDeviceMarks } from "../../components/session-device-mark";
import type {
  BusinessAssignment,
  Directory,
  PeopleSearch,
  Person,
  PersonSession,
} from "../../lib/admin";
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
  validatePeopleSearch,
} from "../../lib/admin";
import { eventAction, relativeTime } from "../../lib/identity-operations";
import { parseUserAgent } from "../../lib/session-device";
import { PositionDialog, PositionSummary, usePersonAdmin } from "./index";

export const Route = createFileRoute("/_shell/people/$personId")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      params,
      search,
      to: "/identity-access/people/$personId",
    });
  },
  validateSearch: validatePeopleSearch,
});

type SectionKey = "access" | "auth" | "meta";

export function PersonWorkspace({
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

function PersonWorkspaceContent({
  person,
  search,
}: {
  person: Person;
  search: PeopleSearch;
}) {
  const admin = usePersonAdmin(person);
  const queryClient = useQueryClient();
  const directory = useQuery(directoryQueryOptions);
  const assignments = useQuery(businessAssignmentsQueryOptions);
  const policy = useQuery(businessAccessPolicyQueryOptions);
  const sessions = useQuery(personSessionsQueryOptions(person.id));
  const authenticationPolicy = useQuery(accessPolicyQueryOptions);
  const accounts = useQuery(linkedAccountsQueryOptions(person.id));
  const dashboard = useQuery(dashboardQueryOptions);
  const [editingPosition, setEditingPosition] = useState<
    false | "group" | string
  >(false);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    access: true,
    auth: true,
    meta: false,
  });
  const people = useQuery({
    ...everyPersonQueryOptions,
    enabled: editingPosition !== false,
  });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onError: announce.failed,
    onSuccess: () => {
      announce.done(`Session revoked for ${person.email}`);
      void queryClient.invalidateQueries({
        queryKey: ["admin", "people", person.id, "sessions"],
      });
    },
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
  const positions = (directory.data?.positions ?? []).filter(
    (position) => position.userId === person.id,
  );
  const health = dashboard.data?.people.find(
    (entry) => entry.userId === person.id,
  );
  const recentEvents = (dashboard.data?.events ?? [])
    .filter(
      (event) =>
        event.target === person.email ||
        event.target === person.name ||
        event.actor === person.email,
    )
    .slice(0, 6);
  const initial = (person.name || person.email).trim().charAt(0).toUpperCase();

  const accessSummary = [
    subsidiaries.length === 0
      ? "No membership"
      : `${subsidiaries.length} subsidiar${subsidiaries.length === 1 ? "y" : "ies"}`,
    personAssignments.length === 0
      ? "no business assignments"
      : `${personAssignments.length} assignment${personAssignments.length === 1 ? "" : "s"}`,
    `${positions.length} position${positions.length === 1 ? "" : "s"}`,
  ].join(" · ");

  const authSummary = [
    sessions.isPending
      ? "Reading sessions"
      : `${sessions.data?.length ?? 0} session${(sessions.data?.length ?? 0) === 1 ? "" : "s"}`,
    person.twoFactorEnabled ? "MFA on" : "MFA off",
    person.mustChangePassword ? "temporary password" : "password current",
  ].join(" · ");

  const metaSummary = [
    `${recentEvents.length} recent event${recentEvents.length === 1 ? "" : "s"}`,
    `created ${new Date(person.createdAt).toLocaleDateString()}`,
  ].join(" · ");

  const showSticky =
    admin.canResetPassword || admin.canRevokeSessions || admin.canSuspend;

  function toggle(key: SectionKey) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <Page
      actions={
        <div className="gap-2 flex items-center">
          {admin.canAdminister ? (
            <Button onClick={() => admin.request("edit")} size="sm">
              Edit account
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
      description={person.email}
      title={person.name || person.email}
    >
      <div className={`${COLLECTION} ${showSticky ? "pb-16" : ""}`}>
        <div className="gap-2 flex flex-col">
          <div className={`${PANEL} gap-3 px-3.5 py-3.5 flex items-center`}>
            <Avatar size="lg">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="gap-x-3 gap-y-1 flex flex-wrap items-center">
                <Mark
                  label={
                    standingOf(person) === "suspended" ? "Suspended" : "Active"
                  }
                  tone={standingOf(person) === "suspended" ? "bad" : "done"}
                />
                <span className="text-[13px] text-muted-foreground">
                  {identityRoleLabel(person.role)}
                </span>
              </div>
              <p className={`${FIGURE} mt-1 text-muted-foreground`}>
                {health?.lastActiveAt
                  ? `Last active ${relativeTime(health.lastActiveAt)}`
                  : "No recorded activity"}
                {health
                  ? ` · ${health.activeSessions} active session${health.activeSessions === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <Mark
              label={
                person.twoFactorEnabled
                  ? "Two-factor enabled"
                  : "Two-factor not set up"
              }
              tone={person.twoFactorEnabled ? "done" : "warn"}
            />
          </div>
          {standingOf(person) === "suspended" ||
          !person.emailVerified ||
          person.mustChangePassword ? (
            <SurfaceBanner tone="warn">
              <p>
                <span className="font-medium text-foreground">
                  This account needs attention.
                </span>{" "}
                {accountAttention(person)}
              </p>
            </SurfaceBanner>
          ) : null}
        </div>

        <IdentitySecurityOperations person={person} />

        <Disclosure
          onToggle={() => toggle("access")}
          open={open.access}
          summary={accessSummary}
          title="Access"
        >
          <div className="gap-5 p-3.5 lg:grid-cols-2 grid">
            <div>
              <SectionLabel>Membership</SectionLabel>
              {subsidiaries.length === 0 ? (
                <MutedLine>No subsidiary membership.</MutedLine>
              ) : (
                <ul className="mt-2 gap-2 grid">
                  {subsidiaries.map((subsidiary) => {
                    const subsidiaryTeams = teams.filter(
                      (team) => team.organizationId === subsidiary.id,
                    );
                    return (
                      <li className="text-xs" key={subsidiary.id}>
                        <p className="font-medium">{subsidiary.name}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {subsidiaryTeams.length
                            ? subsidiaryTeams
                                .map((team) => team.name)
                                .join(", ")
                            : "No team membership"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                className="mt-3 -ml-2"
                nativeButton={false}
                render={<Link to="/subsidiaries" />}
                size="sm"
                variant="ghost"
              >
                Manage membership
              </Button>
            </div>
            <div>
              <SectionLabel>Business assignments</SectionLabel>
              {personAssignments.length === 0 ? (
                <MutedLine>No business access assigned.</MutedLine>
              ) : (
                <AssignmentSummary
                  assignments={personAssignments}
                  directory={directory.data}
                  roles={policy.data?.roles ?? []}
                />
              )}
              <Button
                className="mt-3 -ml-2"
                nativeButton={false}
                render={
                  <Link to="/identity-access/business-access/assignments" />
                }
                size="sm"
                variant="ghost"
              >
                Review business access
              </Button>
            </div>
          </div>
          <div className="px-3.5 py-3.5 border-t border-border/60">
            <div className="mb-3 gap-3 flex items-start justify-between">
              <div>
                <SectionLabel>Position and reporting</SectionLabel>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Titles never grant permissions.
                </p>
              </div>
              {admin.canAdminister ? (
                <Button
                  onClick={() => setEditingPosition("group")}
                  size="sm"
                  variant="outline"
                >
                  Add or edit position
                </Button>
              ) : null}
            </div>
            <PositionSummary
              canEdit={admin.canAdminister}
              onEdit={setEditingPosition}
              personId={person.id}
              positions={directory.data?.positions ?? []}
              subsidiaries={directory.data?.subsidiaries ?? []}
            />
          </div>
        </Disclosure>

        <Disclosure
          onToggle={() => toggle("auth")}
          open={open.auth}
          summary={authSummary}
          title="Authentication"
        >
          <div className="gap-4 p-3.5 sm:grid-cols-3 grid">
            <Fact
              label="Two-factor"
              value={person.twoFactorEnabled ? "Enabled" : "Not set up"}
            />
            <Fact
              label="Password"
              value={
                person.mustChangePassword
                  ? person.temporaryPasswordExpiresAt
                    ? `Temporary password expires ${new Date(person.temporaryPasswordExpiresAt).toLocaleString()}`
                    : "Temporary password replacement required"
                  : "Current"
              }
            />
            <Fact
              label="Linked accounts"
              value={accounts.data ? String(accounts.data.length) : "Reading…"}
            />
          </div>
          <div className="px-3.5 pb-3 border-t border-border/60">
            <div className="py-2.5 flex items-center justify-between">
              <SectionLabel>Linked accounts</SectionLabel>
              <span className="text-xs text-muted-foreground tabular-nums">
                {accounts.data?.length ?? 0}
              </span>
            </div>
            {accounts.isPending ? (
              <Skeleton className="h-10" />
            ) : accounts.isError ? (
              <p className="text-xs text-destructive">
                {accounts.error.message}
              </p>
            ) : accounts.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No linked accounts.
              </p>
            ) : (
              <ul className="gap-0.5 flex flex-col">
                {accounts.data.map((account) => (
                  <li
                    className="row-hover-bg gap-3 px-2 py-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1fr)_auto] sm:items-center grid rounded-md"
                    key={account.id}
                  >
                    <p className="text-xs font-medium capitalize">
                      {account.providerId}
                    </p>
                    <p className="font-mono truncate text-[0.6875rem] text-muted-foreground">
                      {account.accountId}
                    </p>
                    <time className="text-[0.6875rem] text-muted-foreground tabular-nums">
                      Linked {new Date(account.createdAt).toLocaleDateString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="gap-1.5 px-3 pb-2.5 flex flex-col border-t border-border/60">
            <div className="pt-2 flex items-center justify-between">
              <p className="font-medium text-[12px]">Active sessions</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {sessions.data?.length ?? 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {authenticationPolicy.data
                ? `Up to ${authenticationPolicy.data.session.concurrentLimit} active sessions per person.`
                : authenticationPolicy.isError
                  ? "Session limit is unavailable."
                  : "Reading session limit…"}
            </p>
            {sessions.isPending ? (
              <ul className="gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-16 rounded-md" />
              </ul>
            ) : sessions.isError ? (
              <p className="text-xs text-destructive">
                {sessions.error.message}
              </p>
            ) : sessions.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active sessions.
              </p>
            ) : (
              <ul className="gap-1.5 sm:grid-cols-2 xl:grid-cols-3 grid">
                {sessions.data.map((session) => (
                  <SessionCard
                    canRevoke={admin.canRevokeSessions}
                    key={session.id}
                    pending={revoke.isPending}
                    session={session}
                    onRevoke={() => revoke.mutate(session.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Disclosure>

        <Disclosure
          onToggle={() => toggle("meta")}
          open={open.meta}
          summary={metaSummary}
          title="Account and activity"
        >
          <div className="gap-6 p-3.5 lg:grid-cols-2 grid">
            <div className="gap-4 grid">
              <Fact label="Work email" mono value={person.email} />
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
              <Fact
                label="Email"
                value={person.emailVerified ? "Verified" : "Not verified"}
              />
            </div>
            <div>
              {recentEvents.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">
                  No recent activity for this account.
                </p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {recentEvents.map((event) => (
                    <li className="py-2.5" key={event.id}>
                      <p className="text-[13px]">{eventAction(event)}</p>
                      <time
                        className={`${FIGURE} mt-1 block text-muted-foreground`}
                        dateTime={new Date(event.at).toISOString()}
                      >
                        {relativeTime(event.at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2">
                <Button
                  nativeButton={false}
                  render={<Link to="/identity-access/activity" />}
                  size="sm"
                  variant="ghost"
                >
                  View recent activity
                </Button>
              </div>
            </div>
          </div>
        </Disclosure>
      </div>

      {showSticky ? (
        <div className="bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 py-3 sm:px-6 lg:px-8 sticky z-10 border-t border-border/80 bg-background/95">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <p className="text-[12px] text-muted-foreground">
              Dangerous actions stay one step away.
            </p>
            <div className="gap-1.5 flex flex-wrap">
              {admin.canResetPassword ? (
                <Button
                  onClick={() => admin.request("password")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Issue new password
                </Button>
              ) : null}
              {admin.canRevokeSessions ? (
                <Button
                  onClick={() => admin.request("sessions")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Revoke all sessions
                </Button>
              ) : null}
              {admin.canSuspend ? (
                <Button
                  onClick={() =>
                    admin.request(admin.suspended ? "restore" : "suspend")
                  }
                  size="sm"
                  type="button"
                  variant={admin.suspended ? "outline" : "destructive"}
                >
                  {admin.suspended ? "Restore access" : "Suspend access"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
      {admin.dialogs}
    </Page>
  );
}

function Disclosure({
  children,
  onToggle,
  open,
  summary,
  title,
}: {
  children: ReactNode;
  onToggle: () => void;
  open: boolean;
  summary: string;
  title: string;
}) {
  return (
    <div className={PANEL}>
      <button
        aria-expanded={open}
        className={cn(
          "gap-2 px-3.5 py-3 flex w-full items-start justify-between text-left",
          "ease-out transition-colors duration-150 hover:bg-muted/40",
          "active:scale-[0.995]",
          "motion-reduce:transition-none motion-reduce:active:scale-100",
        )}
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <p className={SECTION}>{title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{summary}</p>
        </div>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      <div
        className={cn(
          "ease-out grid transition-[grid-template-rows,opacity] duration-200",
          "motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden border-t border-border/60">
          {children}
        </div>
      </div>
    </div>
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
  session: PersonSession;
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
  admin: ReturnType<typeof usePersonAdmin>;
  person: Person;
}) {
  const hasActions =
    admin.canResetPassword ||
    admin.canRevokeSessions ||
    admin.canSuspend ||
    admin.canDelete ||
    admin.canImpersonate;
  if (!hasActions) return <Mark label="Read only" tone="waiting" />;

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
        <DropdownMenuGroup>
          {admin.canResetPassword ? (
            <DropdownMenuItem onClick={() => admin.request("password")}>
              Issue new password
            </DropdownMenuItem>
          ) : null}
          {admin.canRevokeSessions ? (
            <DropdownMenuItem onClick={() => admin.request("sessions")}>
              Revoke all sessions
            </DropdownMenuItem>
          ) : null}
          {admin.canImpersonate ? (
            <DropdownMenuItem onClick={() => admin.request("impersonate")}>
              Impersonate person
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {admin.canSuspend || admin.canDelete ? <DropdownMenuSeparator /> : null}
        <DropdownMenuGroup>
          {admin.canSuspend ? (
            <DropdownMenuItem
              onClick={() =>
                admin.request(admin.suspended ? "restore" : "suspend")
              }
              variant={admin.suspended ? undefined : "destructive"}
            >
              {admin.suspended ? "Restore access" : "Suspend access"}
            </DropdownMenuItem>
          ) : null}
          {admin.canDelete ? (
            <DropdownMenuItem
              onClick={() => admin.request("delete")}
              variant="destructive"
            >
              Delete account
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className={SECTION}>{children}</h3>;
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

function identityRoleLabel(role: string | null | undefined): string {
  return (
    {
      admin: "Identity administrator",
      "access-reviewer": "Access reviewer",
      helpdesk: "Helpdesk",
      "super-admin": "Super administrator",
      user: "Employee",
    }[role ?? "user"] ??
    role ??
    "Employee"
  );
}

function accountAttention(person: Person): string {
  const issues = [
    standingOf(person) === "suspended" ? "Sign-in is suspended." : null,
    !person.emailVerified ? "The work email is not verified." : null,
    person.mustChangePassword
      ? "The temporary password must be replaced before workspace access."
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
