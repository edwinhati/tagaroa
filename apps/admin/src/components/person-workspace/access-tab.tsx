import { Button } from "@repo/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  type BusinessAssignment,
  businessAccessPolicyQueryOptions,
  businessAssignmentsQueryOptions,
} from "../../lib/business-access";
import { type Directory, directoryQueryOptions } from "../../lib/directory";
import { type Person, everyPersonQueryOptions } from "../../lib/people";
import { Mark, PANEL } from "../admin-surface";
import { PositionDialog, PositionSummary } from "../person-admin";
import { MutedLine, Row } from "./tab-row";

export function AccessTab({
  canEdit,
  person,
}: {
  canEdit: boolean;
  person: Person;
}) {
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
