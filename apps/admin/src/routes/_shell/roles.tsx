import { AppTrail, Page } from "@repo/shell/app-shell";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui/components/native-select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
} from "@tanstack/react-router";
import { ShieldAlertIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  COLUMN,
  Failed,
  Mark,
  MONO,
  PANEL,
  SurfaceBanner,
  SurfaceSection,
} from "../../components/admin-surface";
import {
  activateEmergencyAccess,
  AdminApiError,
  announce,
  archiveBusinessRole,
  businessAccessPolicyQueryOptions,
  businessAssignmentsQueryOptions,
  type BusinessAssignment,
  type BusinessPermission,
  type BusinessRole,
  createBusinessRole,
  directoryQueryOptions,
  endEmergencyAccess,
  emergencyAccessQueryOptions,
  everyPersonQueryOptions,
  grantBusinessAssignment,
  reauthenticateForCurrentPage,
  revokeBusinessAssignment,
  updateBusinessRole,
} from "../../lib/admin";

export const Route = createFileRoute("/_shell/roles")({
  beforeLoad: () => {
    throw redirect({ to: "/identity-access/business-access/roles" });
  },
});

const shellRoute = getRouteApi("/_shell");

const handleMutationError = (error: Error) => {
  if (error instanceof AdminApiError && error.code === "SESSION_NOT_FRESH") {
    reauthenticateForCurrentPage();
    return;
  }
  announce.failed(error);
};

export function BusinessAccess({ view }: { view: "assignments" | "roles" }) {
  const { session } = shellRoute.useRouteContext();
  const policy = useQuery(businessAccessPolicyQueryOptions);
  const assignments = useQuery(businessAssignmentsQueryOptions);
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const roles = (session?.user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const superAdmin = roles.includes("super-admin");
  const canAssign = superAdmin || roles.includes("admin");
  const [editingRole, setEditingRole] = useState<BusinessRole | null | "new">(
    null,
  );
  const [assigning, setAssigning] = useState(false);

  return (
    <Page
      actions={
        <div className="gap-2 flex">
          {view === "roles" && superAdmin ? (
            <Button onClick={() => setEditingRole("new")} size="sm">
              Create role
            </Button>
          ) : null}
          {view === "assignments" && canAssign ? (
            <Button onClick={() => setAssigning(true)} size="sm">
              Assign access
            </Button>
          ) : null}
          {!canAssign ? <Mark label="Read only" tone="waiting" /> : null}
        </div>
      }
      breadcrumb={
        <AppTrail
          items={[
            { label: "Identity & access", to: "/identity-access" },
            { label: "Business access" },
          ]}
        />
      }
      description="Explicit permissions inside a subsidiary or team. Titles never grant access."
      title="Business access"
    >
      <BusinessAccessNavigation view={view} />

      {view === "roles" ? (
        <SurfaceSection
          className="mt-4"
          title="Role library"
          trailing={
            !superAdmin ? <Mark label="Read only" tone="waiting" /> : null
          }
        >
          {policy.isPending ? (
            <div className="gap-2 p-3.5 flex flex-col" aria-hidden="true">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : policy.isError || !policy.data ? (
            <Failed
              error={
                policy.error ?? { message: "Could not read business roles." }
              }
              framed={false}
              onRetry={() => void policy.refetch()}
              what="business roles"
            />
          ) : (
            <div
              className="roles-hier relative"
              role="region"
              aria-label="Business role library"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th className={COLUMN} scope="col">
                      Role
                    </th>
                    <th className={COLUMN} scope="col">
                      Permissions
                    </th>
                    <th className={COLUMN} scope="col">
                      Assignments
                    </th>
                    <th className={COLUMN} scope="col">
                      Access level
                    </th>
                    <th className="roles-hier-actions" scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {policy.data.roles.map((role) => (
                    <tr key={role.id}>
                      <td className="roles-hier-role">
                        <p className="roles-hier-name">{role.name}</p>
                        <p
                          className={`roles-hier-key ${MONO} text-muted-foreground`}
                        >
                          {role.key}
                        </p>
                        <p className="roles-hier-desc">{role.description}</p>
                      </td>
                      <td className="roles-hier-perm">
                        {role.permissions
                          .map(
                            (permission) =>
                              policy.data.permissions.find(
                                (item) => item.key === permission,
                              )?.label ?? permission,
                          )
                          .join(", ")}
                      </td>
                      <td className="roles-hier-count">
                        {role.assignmentCount}
                      </td>
                      <td>
                        <div className="roles-hier-marks">
                          {role.archivedAt ? (
                            <Mark label="Archived" tone="quiet" />
                          ) : null}
                          {role.system ? (
                            <Mark label="Built in" tone="quiet" />
                          ) : null}
                          <Mark
                            label={role.privileged ? "Privileged" : "Standard"}
                            tone={role.privileged ? "away" : "quiet"}
                          />
                        </div>
                      </td>
                      <td className="roles-hier-actions">
                        {superAdmin && !role.system && !role.archivedAt ? (
                          <div className="gap-1 flex justify-end whitespace-nowrap">
                            <Button
                              onClick={() => setEditingRole(role)}
                              size="sm"
                              variant="ghost"
                            >
                              Edit role
                            </Button>
                            <ArchiveRoleButton role={role} />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceSection>
      ) : (
        <SurfaceSection
          className="mt-4"
          title="Active and previous assignments"
        >
          {assignments.isPending ||
          policy.isPending ||
          directory.isPending ||
          people.isPending ? (
            <div className="gap-2 p-3.5 flex flex-col" aria-hidden="true">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : assignments.isError ||
            policy.isError ||
            directory.isError ||
            people.isError ? (
            <Failed
              error={{
                message:
                  assignments.error?.message ??
                  policy.error?.message ??
                  directory.error?.message ??
                  people.error?.message ??
                  "Could not read business access assignments.",
              }}
              framed={false}
              what="business access assignments"
            />
          ) : (
            <AssignmentList
              assignments={assignments.data ?? []}
              canManage={canAssign}
              people={people.data ?? []}
              roles={policy.data?.roles ?? []}
              subsidiaries={directory.data?.subsidiaries ?? []}
              teams={directory.data?.teams ?? []}
            />
          )}
        </SurfaceSection>
      )}

      {view === "roles" && policy.data ? (
        <RoleEditor
          open={editingRole !== null}
          permissions={policy.data.permissions}
          role={editingRole === "new" ? null : editingRole}
          onOpenChange={(open) => !open && setEditingRole(null)}
        />
      ) : null}
      {view === "assignments" &&
      policy.data &&
      directory.data &&
      people.data ? (
        <AssignmentEditor
          open={assigning}
          people={people.data}
          roles={policy.data.roles.filter(
            (role) => !role.archivedAt && (superAdmin || !role.privileged),
          )}
          subsidiaries={directory.data.subsidiaries}
          teams={directory.data.teams}
          onOpenChange={setAssigning}
        />
      ) : null}
    </Page>
  );
}

function BusinessAccessNavigation({ view }: { view: "assignments" | "roles" }) {
  return (
    <nav aria-label="Business access views" className="mb-1">
      <div className="gap-1 flex">
        <Link
          aria-current={view === "assignments" ? "page" : undefined}
          className="px-2.5 py-1.5 aria-[current=page]:font-medium rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
          to="/identity-access/business-access/assignments"
        >
          Assignments
        </Link>
        <Link
          aria-current={view === "roles" ? "page" : undefined}
          className="px-2.5 py-1.5 aria-[current=page]:font-medium rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
          to="/identity-access/business-access/roles"
        >
          Roles
        </Link>
      </div>
    </nav>
  );
}

function ArchiveRoleButton({ role }: { role: BusinessRole }) {
  const queryClient = useQueryClient();
  const archive = useMutation({
    mutationFn: () => archiveBusinessRole(role.id),
    onError: handleMutationError,
    onSuccess: () => {
      announce.done("Role archived");
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
    },
  });
  return (
    <Button
      disabled={role.assignmentCount > 0 || archive.isPending}
      onClick={() => archive.mutate()}
      size="sm"
      title={
        role.assignmentCount > 0
          ? "Revoke this role's assignments before archiving it."
          : undefined
      }
      variant="ghost"
    >
      Archive
    </Button>
  );
}

function RoleEditor({
  open,
  permissions,
  role,
  onOpenChange,
}: {
  open: boolean;
  permissions: BusinessPermission[];
  role: BusinessRole | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const save = useMutation({
    mutationFn: () =>
      role
        ? updateBusinessRole(role.id, {
            description,
            name,
            permissions: selected,
          })
        : createBusinessRole({ description, key, name, permissions: selected }),
    onError: handleMutationError,
    onSuccess: () => {
      announce.done(role ? "Role updated" : "Role created");
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {role ? `Edit ${role.name}` : "Create a business role"}
          </DialogTitle>
          <DialogDescription>
            Every assignment using this role changes as soon as you save it.
            Sensitive changes may ask you to sign in again.
          </DialogDescription>
        </DialogHeader>
        <div className="gap-4 grid">
          <div className="gap-2 grid">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              onChange={(event) => {
                const value = event.target.value;
                setName(value);
                if (!role) {
                  setKey(
                    value
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  );
                }
              }}
              value={name}
            />
          </div>
          {!role ? (
            <div className="gap-2 grid">
              <Label htmlFor="role-key">Stable key</Label>
              <Input
                id="role-key"
                className="font-mono"
                onChange={(event) => setKey(event.target.value)}
                value={key}
              />
            </div>
          ) : null}
          <div className="gap-2 grid">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </div>
          <fieldset className="gap-0 grid">
            <legend className={`${COLUMN} mb-2`}>Permissions</legend>
            <div className={`${PANEL} px-3 py-1`}>
              {permissions.map((permission) => {
                const checked = selected.includes(permission.key);
                return (
                  <label
                    className="row-hover gap-3 text-sm font-medium flex items-start leading-none select-none"
                    key={permission.key}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setSelected((current) =>
                          next
                            ? [...new Set([...current, permission.key])]
                            : current.filter((key) => key !== permission.key),
                        )
                      }
                    />
                    <span>
                      <span className="block text-[13px]">
                        {permission.label}
                      </span>
                      <span className="mt-0.5 font-normal block text-[12.5px] text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {role && role.assignmentCount > 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              Saving updates {role.assignmentCount} existing assignment
              {role.assignmentCount === 1 ? "" : "s"} immediately.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={
              save.isPending ||
              !name.trim() ||
              !description.trim() ||
              selected.length === 0
            }
            onClick={() => save.mutate()}
            size="sm"
          >
            {save.isPending ? "Saving…" : "Save role"}
          </Button>
          <DialogClose render={<Button size="sm" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentList({
  assignments,
  canManage,
  people,
  roles,
  subsidiaries,
  teams,
}: {
  assignments: BusinessAssignment[];
  canManage: boolean;
  people: { email: string; id: string; name: string }[];
  roles: BusinessRole[];
  subsidiaries: { id: string; name: string }[];
  teams: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: revokeBusinessAssignment,
    onError: handleMutationError,
    onSuccess: () => {
      announce.done("Access revoked");
      void queryClient.invalidateQueries({
        queryKey: businessAssignmentsQueryOptions.queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
    },
  });
  const personById = new Map(people.map((person) => [person.id, person]));
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const subsidiaryById = new Map(subsidiaries.map((item) => [item.id, item]));
  const teamById = new Map(teams.map((item) => [item.id, item]));

  if (assignments.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="font-medium text-[13px]">
          No business access has been assigned
        </p>
        <p className="mt-1.5 leading-relaxed mx-auto max-w-[52ch] text-[13px] text-muted-foreground">
          Assign a role to a person inside a subsidiary or team to grant
          permissions.
        </p>
      </div>
    );
  }
  return (
    <div className="px-3 py-1">
      {assignments.map((assignment) => (
        <div
          className="row-hover gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.8fr)_minmax(12rem,1fr)_auto] sm:items-center grid"
          key={assignment.id}
        >
          <div className="min-w-0">
            <p className="truncate text-[13px]">
              {personById.get(assignment.userId)?.name ?? assignment.userId}
            </p>
            <p className={`mt-0.5 truncate text-muted-foreground ${MONO}`}>
              {personById.get(assignment.userId)?.email}
            </p>
          </div>
          <div>
            <p className="text-[13px]">
              {roleById.get(assignment.roleId)?.name ?? assignment.role.name}
            </p>
            <div className="mt-1">
              <Mark
                label={
                  assignment.active
                    ? "Active"
                    : inactiveReasonLabel(assignment.inactiveReason)
                }
                tone={assignment.active ? "done" : "quiet"}
              />
            </div>
          </div>
          <div className="text-[13px]">
            <p>
              {subsidiaryById.get(assignment.organizationId)?.name ??
                assignment.organizationId}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {assignment.teamId
                ? (teamById.get(assignment.teamId)?.name ?? assignment.teamId)
                : "All teams"}
              {assignment.expiresAt
                ? ` · expires ${new Date(assignment.expiresAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          {canManage && !assignment.revokedAt ? (
            <Button
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(assignment.id)}
              size="sm"
              variant="ghost"
            >
              Revoke
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const inactiveReasonLabel = (reason: string | null): string =>
  ({
    expired: "Expired",
    "left-subsidiary": "Left subsidiary",
    "left-team": "Left team",
    "mfa-required": "Two-factor required",
    revoked: "Revoked",
    "role-archived": "Role archived",
  })[reason ?? ""] ?? "Inactive";

function AssignmentEditor({
  open,
  people,
  roles,
  subsidiaries,
  teams,
  onOpenChange,
}: {
  open: boolean;
  people: { email: string; id: string; name: string }[];
  roles: BusinessRole[];
  subsidiaries: { id: string; memberIds: string[]; name: string }[];
  teams: {
    id: string;
    memberIds: string[];
    name: string;
    organizationId: string;
  }[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [scope, setScope] = useState<"subsidiary" | "team">("team");
  const [teamId, setTeamId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const selectedRole = roles.find((role) => role.id === roleId);
  const availableTeams = teams.filter(
    (team) =>
      team.organizationId === organizationId &&
      (!userId || team.memberIds.includes(userId)),
  );
  const availablePeople = organizationId
    ? people.filter((person) =>
        subsidiaries
          .find((subsidiary) => subsidiary.id === organizationId)
          ?.memberIds.includes(person.id),
      )
    : people;
  const grant = useMutation({
    mutationFn: () =>
      grantBusinessAssignment({
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        organizationId,
        roleId,
        scope,
        teamId: scope === "team" ? teamId : null,
        userId,
      }),
    onError: handleMutationError,
    onSuccess: () => {
      announce.done("Access assigned");
      void queryClient.invalidateQueries({
        queryKey: businessAssignmentsQueryOptions.queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: businessAccessPolicyQueryOptions.queryKey,
      });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign business access</DialogTitle>
          <DialogDescription>
            Choose the person, role, and exact part of the group where it
            applies.
          </DialogDescription>
        </DialogHeader>
        <div className="gap-4 grid">
          <FieldSelect label="Role" value={roleId} onChange={setRoleId}>
            <NativeSelectOption value="">Choose a role</NativeSelectOption>
            {roles.map((role) => (
              <NativeSelectOption key={role.id} value={role.id}>
                {role.name}
              </NativeSelectOption>
            ))}
          </FieldSelect>
          <FieldSelect
            label="Subsidiary"
            value={organizationId}
            onChange={(value) => {
              setOrganizationId(value);
              setTeamId("");
              setUserId("");
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
            label="Person"
            value={userId}
            onChange={(value) => {
              setUserId(value);
              setTeamId("");
            }}
          >
            <NativeSelectOption value="">Choose a person</NativeSelectOption>
            {availablePeople.map((person) => (
              <NativeSelectOption key={person.id} value={person.id}>
                {person.name} · {person.email}
              </NativeSelectOption>
            ))}
          </FieldSelect>
          <FieldSelect
            label="Scope"
            value={scope}
            onChange={(value) => setScope(value as "subsidiary" | "team")}
          >
            {selectedRole?.assignableScopes.includes("subsidiary") ? (
              <NativeSelectOption value="subsidiary">
                Subsidiary and all teams
              </NativeSelectOption>
            ) : null}
            {selectedRole?.assignableScopes.includes("team") ? (
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
            <Label htmlFor="assignment-expiration">
              Expiration{" "}
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </Label>
            <Input
              id="assignment-expiration"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
          {selectedRole?.privileged ? (
            <p className="text-xs text-muted-foreground">
              This is privileged access. The person must already use two-factor
              authentication, and you may be asked to sign in again.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={
              grant.isPending ||
              !userId ||
              !roleId ||
              !organizationId ||
              (scope === "team" && !teamId)
            }
            onClick={() => grant.mutate()}
            size="sm"
          >
            {grant.isPending ? "Assigning…" : "Assign access"}
          </Button>
          <DialogClose render={<Button size="sm" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  children,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="gap-2 text-sm font-medium grid">
      {label}
      <NativeSelect
        className="w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </label>
  );
}

export function EmergencyAccessDialog({
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
    onError: handleMutationError,
    onSuccess: async () => {
      await queryClient.invalidateQueries(emergencyAccessQueryOptions);
      announce.done("Emergency access active for 15 minutes");
    },
  });
  const end = useMutation({
    mutationFn: () => endEmergencyAccess(active?.id ?? ""),
    onError: handleMutationError,
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
                {activate.isPending ? "Activating…" : "Activate for 15 minutes"}
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
