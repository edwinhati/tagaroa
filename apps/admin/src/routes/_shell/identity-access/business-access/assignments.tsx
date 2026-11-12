import { isSuperAdmin, mayRun } from "@repo/contracts/identity";
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { NativeSelectOption } from "@repo/ui/components/native-select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import {
  Failed,
  Mark,
  MONO,
  SurfaceSection,
} from "../../../../components/admin-surface";
import {
  BusinessAccessPage,
  FieldSelect,
} from "../../../../components/business-access";
import {
  announce,
  businessAccessPolicyQueryOptions,
  businessAssignmentsQueryOptions,
  directoryQueryOptions,
  everyPersonQueryOptions,
  grantBusinessAssignment,
  revokeBusinessAssignment,
  type BusinessAssignment,
  type BusinessRole,
} from "../../../../lib/admin";

const shellRoute = getRouteApi("/_shell");

export const Route = createFileRoute(
  "/_shell/identity-access/business-access/assignments",
)({
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { session } = shellRoute.useRouteContext();
  const policy = useQuery(businessAccessPolicyQueryOptions);
  const assignments = useQuery(businessAssignmentsQueryOptions);
  const directory = useQuery(directoryQueryOptions);
  const people = useQuery(everyPersonQueryOptions);
  const superAdmin = isSuperAdmin(session?.user?.role);
  const canAssign = mayRun(session?.user?.role, "administer");
  const [assigning, setAssigning] = useState(false);

  return (
    <BusinessAccessPage
      actions={
        canAssign ? (
          <Button onClick={() => setAssigning(true)} size="sm">
            Assign access
          </Button>
        ) : (
          <Mark label="Read only" tone="waiting" />
        )
      }
    >
      <SurfaceSection className="mt-4" title="Active and previous assignments">
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

      {policy.data && directory.data && people.data ? (
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
    </BusinessAccessPage>
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
    onError: announce.failed,
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
    onError: announce.failed,
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
