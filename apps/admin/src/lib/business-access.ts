import { type Wire } from "@repo/contracts";
import {
  type AccessAssignmentRecord,
  type AccessReviewSubject,
  type AccessRoleRecord,
  type AccessRoleView,
  type AssignmentView,
  type BusinessAccessPolicy,
  type EmergencyElevation,
  type TeamDomain,
} from "@repo/contracts/access-control";
import {
  type BindDomainBody,
  type BreakGlassBody,
  type CreateRoleBody,
  type GrantAssignmentBody,
  type ReviewAccessBody,
  type UpdateRoleBody,
} from "@repo/contracts/requests/access-control";
import { queryOptions } from "@tanstack/react-query";

import { coreMutationDocument, coreReadDocument } from "./api";

export type BusinessRole = Wire<AccessRoleView>;

export type BusinessAssignment = Wire<AssignmentView>;

export const businessAccessPolicyQueryOptions = queryOptions({
  queryKey: ["admin", "business-access-policy"],
  queryFn: () =>
    coreReadDocument<Wire<BusinessAccessPolicy>>(
      "/api/access-control/policy",
      "Could not read business access policy.",
    ),
});

export const businessAssignmentsQueryOptions = queryOptions({
  queryKey: ["admin", "business-access-assignments"],
  queryFn: () =>
    coreReadDocument<BusinessAssignment[]>(
      "/api/access-control/assignments",
      "Could not read access assignments.",
    ),
});

export const createBusinessRole = (input: Wire<CreateRoleBody>) =>
  coreMutationDocument<Wire<AccessRoleRecord>>(
    "/api/access-control/roles",
    "POST",
    input,
    "Could not create the role.",
  );

export const updateBusinessRole = (
  roleId: string,
  input: Wire<UpdateRoleBody>,
) =>
  coreMutationDocument<Wire<AccessRoleRecord>>(
    `/api/access-control/roles/${roleId}`,
    "PATCH",
    input,
    "Could not update the role.",
  );

export const archiveBusinessRole = (roleId: string) =>
  coreMutationDocument<{ archived: true }>(
    `/api/access-control/roles/${roleId}`,
    "DELETE",
    undefined,
    "Could not archive the role.",
  );

export const grantBusinessAssignment = (input: Wire<GrantAssignmentBody>) =>
  coreMutationDocument<Wire<AccessAssignmentRecord>>(
    "/api/access-control/assignments",
    "POST",
    input,
    "Could not grant access.",
  );

export const revokeBusinessAssignment = (assignmentId: string) =>
  coreMutationDocument<{ revoked: true }>(
    `/api/access-control/assignments/${assignmentId}`,
    "DELETE",
    undefined,
    "Could not revoke access.",
  );

export const activateEmergencyAccess = (input: Wire<BreakGlassBody>) =>
  coreMutationDocument<Wire<EmergencyElevation>>(
    "/api/access-control/break-glass",
    "POST",
    input,
    "Could not activate emergency access.",
  );

export const endEmergencyAccess = (elevationId: string) =>
  coreMutationDocument<{ ended: true }>(
    `/api/access-control/break-glass/${elevationId}`,
    "DELETE",
    undefined,
    "Could not end emergency access.",
  );

export const emergencyAccessQueryOptions = queryOptions({
  queryKey: ["admin", "emergency-access"],
  queryFn: () =>
    coreReadDocument<Wire<EmergencyElevation>[]>(
      "/api/access-control/break-glass",
      "Could not read emergency access.",
    ),
});

export type ReviewSubject = Wire<AccessReviewSubject>;

export const accessReviewQueueQueryOptions = queryOptions({
  queryKey: ["admin", "access-review-queue"],
  queryFn: () =>
    coreReadDocument<ReviewSubject[]>(
      "/api/access-control/reviews",
      "Could not read business access reviews.",
    ),
});

export const recordBusinessAccessReview = (input: {
  subject: ReviewSubject;
  decision: ReviewAccessBody["decision"];
  note: string;
}) =>
  coreMutationDocument(
    `/api/access-control/reviews/${input.subject.kind}/${input.subject.id}`,
    "POST",
    {
      snapshot: input.subject.snapshot,
      decision: input.decision,
      note: input.note,
    } satisfies Wire<ReviewAccessBody>,
    "Could not record the review.",
  );

export const teamDomainBindingsQueryOptions = queryOptions({
  queryKey: ["admin", "team-domain-bindings"],
  queryFn: () =>
    coreReadDocument<TeamDomain[]>(
      "/api/access-control/team-domains",
      "Could not read team domain links.",
    ),
});

export const bindTeamDomain = (
  teamId: string,
  domainSlug: BindDomainBody["domainSlug"],
) =>
  coreMutationDocument(
    `/api/access-control/teams/${teamId}/domain`,
    "PUT",
    { domainSlug } satisfies BindDomainBody,
    "Could not change the team's domain.",
  );
