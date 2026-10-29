import type { PermissionKey } from "../domain/access-policy";

export const ACCESS_CONTROL = Symbol("ACCESS_CONTROL");

export interface AccessDecisionInput {
  identityRole: string | null | undefined;
  organizationId: string;
  permission: PermissionKey;
  sessionCreatedAt: Date;
  sessionId: string;
  teamId: string | null;
  userId: string;
}

/** The only business-access contract exported to other Nest modules. */
export interface AccessControl {
  can(input: AccessDecisionInput): Promise<boolean>;
}
