import {
  ACCESS_WINDOWS,
  isSuperAdmin,
  hasAnyRole,
  IDENTITY_ROLES,
  type IdentityRole,
  isPrivilegedRole,
  primaryRoleLabel,
} from "@repo/contracts/identity";
import { AppTrail, Page } from "@repo/shell/app-shell";
import { authClient } from "@repo/shell/auth-client";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, createFileRoute } from "@tanstack/react-router";
import { ShieldAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  COLUMN,
  Failed,
  Mark,
  MONO,
  SurfaceBanner,
  SurfaceSection,
  COLLECTION,
  FIGURE,
  PanelSkeleton,
} from "../../../components/admin-surface";
import { FieldSelect } from "../../../components/business-access";
import {
  activateEmergencyAccess,
  announce,
  businessAccessPolicyQueryOptions,
  directoryQueryOptions,
  emergencyAccessQueryOptions,
  endEmergencyAccess,
  everyPersonQueryOptions,
  type BusinessPermission,
  type Person,
  accessPolicyQueryOptions,
  refreshPeople,
  write,
} from "../../../lib/admin";

export const Route = createFileRoute(
  "/_shell/identity-access/privileged-access",
)({
  component: PrivilegedAccess,
});

const shellRoute = getRouteApi("/_shell");

function PrivilegedAccess() {
  const { session } = shellRoute.useRouteContext();
  const policy = useQuery(accessPolicyQueryOptions);
  const businessPolicy = useQuery(businessAccessPolicyQueryOptions);
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const superAdmin = isSuperAdmin(session?.user?.role);
  const [assigning, setAssigning] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const privilegedRoles = IDENTITY_ROLES.filter((role) => role.privileged);
  const holders = (people.data ?? []).filter((person) =>
    isPrivilegedRole(person.role),
  );

  return (
    <Page
      actions={
        superAdmin ? (
          <Button onClick={() => setAssigning(true)} size="sm">
            Assign identity role
          </Button>
        ) : (
          <Mark label="Read only" tone="waiting" />
        )
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Privileged access" },
          ]}
        />
      }
      title="Privileged access"
    >
      {policy.isPending || people.isPending ? (
        <div className={COLLECTION}>
          <Skeleton className="h-5 max-w-md" />
          <PanelSkeleton rows={5} />
        </div>
      ) : policy.isError || people.isError ? (
        <Failed
          error={
            policy.error ??
            people.error ?? { message: "Unable to read privileged access." }
          }
          onRetry={() => {
            void policy.refetch();
            void people.refetch();
          }}
          what="privileged access"
        />
      ) : (
        <div className={COLLECTION}>
          <p className="gap-x-3 gap-y-1 flex flex-wrap items-baseline text-[12.5px] text-muted-foreground">
            <span>
              <span className={`${FIGURE} text-foreground`}>
                {privilegedRoles.length}
              </span>{" "}
              identity {privilegedRoles.length === 1 ? "role" : "roles"}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className={`${FIGURE} text-foreground`}>
                {holders.length}
              </span>{" "}
              {holders.length === 1 ? "holder" : "holders"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Two-factor required</span>
          </p>

          <p className="text-[12.5px] text-muted-foreground">
            Privileged accounts require two-factor authentication. Devices can
            be trusted for {policy.data.session.trustedDeviceDays} days.
          </p>

          <SurfaceSection title="Identity roles">
            <div
              className="px-1 relative overflow-x-auto"
              role="region"
              aria-label="Identity role catalog"
              tabIndex={0}
            >
              <table className="register-table w-full min-w-[36rem] text-left text-[13px]">
                <thead>
                  <tr>
                    <th className={COLUMN} scope="col">
                      Role
                    </th>
                    <th className={COLUMN} scope="col">
                      Authority
                    </th>
                    <th className={COLUMN} scope="col">
                      Holders
                    </th>
                    <th className={COLUMN} scope="col">
                      Protection
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {privilegedRoles.map((role) => {
                    const roleHolders = (people.data ?? []).filter((person) =>
                      hasAnyRole(person.role, [role.id]),
                    );
                    return (
                      <tr key={role.id}>
                        <td>
                          <p className="font-medium text-foreground">
                            {role.label}
                          </p>
                          <p className={`${MONO} mt-0.5 text-muted-foreground`}>
                            {role.id}
                          </p>
                        </td>
                        <td className="max-w-xl text-muted-foreground">
                          {role.description}
                        </td>
                        <td className={FIGURE}>{roleHolders.length}</td>
                        <td>
                          <Mark label="Two-factor required" tone="done" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceSection>

          <SurfaceSection
            framed={false}
            title="Role holders"
            trailing={
              <span className={`${FIGURE} text-muted-foreground`}>
                {holders.length}
              </span>
            }
          >
            <RoleHolders people={people.data ?? []} />
          </SurfaceSection>

          {superAdmin ? (
            <SurfaceBanner tone="warn">
              <div className="gap-3 sm:flex-row sm:items-center flex flex-col justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    Emergency access
                  </p>
                  <p className="mt-1 leading-relaxed">
                    One permission for {ACCESS_WINDOWS.breakGlassMinutes}{" "}
                    minutes when a normal assignment cannot resolve an urgent
                    problem. Reason and use are recorded.
                  </p>
                </div>
                <Button
                  className="sm:self-center shrink-0 self-start"
                  onClick={() => setEmergency(true)}
                  size="sm"
                  variant="destructive"
                >
                  Request emergency access
                </Button>
              </div>
            </SurfaceBanner>
          ) : null}
        </div>
      )}

      {policy.data && people.data ? (
        <IdentityRoleDialog
          currentUserId={session?.user?.id ?? ""}
          onOpenChange={setAssigning}
          open={assigning}
          people={people.data}
          roles={IDENTITY_ROLES}
        />
      ) : null}
      {businessPolicy.data && directory.data ? (
        <EmergencyAccessDialog
          onOpenChange={setEmergency}
          open={emergency}
          permissions={businessPolicy.data.permissions.filter(
            (permission) => permission.breakGlass,
          )}
          subsidiaries={directory.data.subsidiaries}
          teams={directory.data.teams}
        />
      ) : null}
    </Page>
  );
}

function RoleHolders({ people }: { people: Person[] }) {
  const privileged = people.filter((person) => isPrivilegedRole(person.role));
  if (privileged.length === 0) {
    return (
      <p className="px-3.5 py-8 text-center text-[13px] text-muted-foreground">
        No privileged accounts
      </p>
    );
  }
  return (
    <ul className="gap-1.5 px-1.5 py-1 flex flex-col">
      {privileged.map((person) => {
        const initial = (person.name || person.email)
          .trim()
          .charAt(0)
          .toUpperCase();
        return (
          <li
            className="row-hover-bg gap-3 px-2 py-2 flex items-center rounded-md border border-border/70"
            key={person.id}
          >
            <Avatar size="sm">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 gap-0.5 flex flex-1 flex-col">
              <p className="font-medium truncate text-[13px]">
                {person.name || person.email}
              </p>
              <div className="gap-2 min-w-0 flex items-center">
                <p className={`${MONO} truncate text-muted-foreground`}>
                  {person.email}
                </p>
                <span aria-hidden="true" className="text-muted-foreground/50">
                  ·
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {primaryRoleLabel(person.role)}
                </span>
              </div>
            </div>
            <Button
              className="shrink-0"
              nativeButton={false}
              render={
                <Link
                  params={{ personId: person.id }}
                  to="/identity-access/people/$personId"
                />
              }
              size="sm"
              variant="ghost"
            >
              Review
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function IdentityRoleDialog({
  currentUserId,
  onOpenChange,
  open,
  people,
  roles,
}: {
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  people: Person[];
  roles: readonly IdentityRole[];
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const assign = useMutation({
    mutationFn: () =>
      write(
        () => authClient.admin.updateUser({ data: { role }, userId }),
        "The identity role was not changed.",
      ),
    onError: announce.failed,
    onSuccess: () => {
      announce.done("Identity role changed");
      void refreshPeople(queryClient);
      onOpenChange(false);
    },
  });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!event.currentTarget.reportValidity()) return;
            assign.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Assign identity role</DialogTitle>
            <DialogDescription>
              Identity roles grant authority across the back office. Review the
              person before changing privileged access.
            </DialogDescription>
          </DialogHeader>
          <div className="gap-4 grid">
            <label className="gap-2 text-sm font-medium grid">
              Person
              <NativeSelect
                className="w-full"
                onChange={(event) => setUserId(event.target.value)}
                required
                value={userId}
              >
                <NativeSelectOption value="">
                  Choose a person
                </NativeSelectOption>
                {people
                  .filter((person) => person.id !== currentUserId)
                  .map((person) => (
                    <NativeSelectOption key={person.id} value={person.id}>
                      {person.name || person.email} · {person.email}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </label>
            <label className="gap-2 text-sm font-medium grid">
              Identity role
              <NativeSelect
                className="w-full"
                onChange={(event) => setRole(event.target.value)}
                required
                value={role}
              >
                <NativeSelectOption value="">Choose a role</NativeSelectOption>
                {roles.map((item) => (
                  <NativeSelectOption key={item.id} value={item.id}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            {isPrivilegedRole(role) ? (
              <p className="text-xs text-muted-foreground">
                This role requires two-factor authentication. The person will be
                prompted to secure their account before returning to the
                workspace.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button disabled={assign.isPending} size="sm" type="submit">
              {assign.isPending ? "Assigning…" : "Assign identity role"}
            </Button>
            <DialogClose render={<Button size="sm" variant="outline" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmergencyAccessDialog({
  open,
  permissions,
  subsidiaries,
  teams,
  onOpenChange,
}: {
  open: boolean;
  permissions: BusinessPermission[];
  subsidiaries: { id: string; name: string }[];
  teams: { id: string; name: string; organizationId: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const [permission, setPermission] = useState(permissions[0]?.key ?? "");
  const [organizationId, setOrganizationId] = useState("");
  const [scope, setScope] = useState<"subsidiary" | "team">("team");
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const elevations = useQuery({
    ...emergencyAccessQueryOptions,
    enabled: open,
    staleTime: 0,
    refetchInterval: open ? 1_000 : false,
  });
  const active = elevations.data?.[0] ?? null;
  const selectedPermission = permissions.find(
    (item) => item.key === permission,
  );
  const activate = useMutation({
    mutationFn: () =>
      activateEmergencyAccess({
        organizationId,
        permission,
        reason,
        scope,
        teamId: scope === "team" ? teamId : null,
      }),
    onError: announce.failed,
    onSuccess: async () => {
      await queryClient.invalidateQueries(emergencyAccessQueryOptions);
      announce.done(
        `Emergency access active for ${ACCESS_WINDOWS.breakGlassMinutes} minutes`,
      );
    },
  });
  const end = useMutation({
    mutationFn: () => endEmergencyAccess(active?.id ?? ""),
    onError: announce.failed,
    onSuccess: async () => {
      await queryClient.invalidateQueries(emergencyAccessQueryOptions);
      announce.done("Emergency access ended");
      onOpenChange(false);
    },
  });
  const availableTeams = useMemo(
    () => teams.filter((team) => team.organizationId === organizationId),
    [organizationId, teams],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="gap-2 flex items-center">
            <ShieldAlertIcon
              aria-hidden="true"
              className="size-4 text-status-warning-text"
              strokeWidth={1.5}
            />
            <DialogTitle>Emergency access</DialogTitle>
          </div>
          <DialogDescription>
            Use this only when the normal assignment path cannot resolve an
            urgent problem. The reason and every use are recorded.
          </DialogDescription>
        </DialogHeader>
        {elevations.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {elevations.error.message}
          </p>
        ) : null}
        {active ? (
          <SurfaceBanner tone="warn">
            <p className="font-medium text-[13px] text-foreground">
              Emergency access is active
            </p>
            <p className="mt-1">
              It ends at {new Date(active.expiresAt).toLocaleTimeString()} or
              when you end it now.
            </p>
            <p className="mt-1">{active.reason}</p>
            <p className="mt-1">
              {permissions.find((item) => item.key === active.permission)
                ?.label ?? active.permission}
              {" · "}
              {subsidiaries.find((item) => item.id === active.organizationId)
                ?.name ?? active.organizationId}
              {active.teamId
                ? ` / ${teams.find((item) => item.id === active.teamId)?.name ?? active.teamId}`
                : " (all teams)"}
            </p>
          </SurfaceBanner>
        ) : (
          <div className="gap-4 grid">
            <FieldSelect
              label="Permission"
              value={permission}
              onChange={setPermission}
            >
              {permissions.map((item) => (
                <NativeSelectOption key={item.key} value={item.key}>
                  {item.label}
                </NativeSelectOption>
              ))}
            </FieldSelect>
            <FieldSelect
              label="Subsidiary"
              value={organizationId}
              onChange={(value) => {
                setOrganizationId(value);
                setTeamId("");
              }}
            >
              <NativeSelectOption value="">
                Choose a subsidiary
              </NativeSelectOption>
              {subsidiaries.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </FieldSelect>
            <FieldSelect
              label="Scope"
              value={scope}
              onChange={(value) => setScope(value as "subsidiary" | "team")}
            >
              {selectedPermission?.scopes.includes("subsidiary") ? (
                <NativeSelectOption value="subsidiary">
                  Subsidiary and all teams
                </NativeSelectOption>
              ) : null}
              {selectedPermission?.scopes.includes("team") ? (
                <NativeSelectOption value="team">One team</NativeSelectOption>
              ) : null}
            </FieldSelect>
            {scope === "team" ? (
              <FieldSelect label="Team" value={teamId} onChange={setTeamId}>
                <NativeSelectOption value="">Choose a team</NativeSelectOption>
                {availableTeams.map((team) => (
                  <NativeSelectOption key={team.id} value={team.id}>
                    {team.name}
                  </NativeSelectOption>
                ))}
              </FieldSelect>
            ) : null}
            <div className="gap-2 grid">
              <Label htmlFor="emergency-reason">Reason</Label>
              <Textarea
                id="emergency-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="What is blocked, and why can it not wait for a normal assignment?"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {active ? (
            <Button
              disabled={end.isPending}
              onClick={() => end.mutate()}
              size="sm"
              variant="destructive"
            >
              End emergency access
            </Button>
          ) : (
            <>
              <Button
                disabled={
                  activate.isPending ||
                  elevations.isPending ||
                  elevations.isError ||
                  !permission ||
                  !organizationId ||
                  !reason.trim() ||
                  (scope === "team" && !teamId)
                }
                onClick={() => activate.mutate()}
                size="sm"
                variant="destructive"
              >
                {activate.isPending
                  ? "Activating…"
                  : `Activate for ${ACCESS_WINDOWS.breakGlassMinutes} minutes`}
              </Button>
              <DialogClose render={<Button size="sm" variant="outline" />}>
                Close
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
