import type { Operator } from "../../auth/session-policy";
import type { PermissionKey } from "../domain/access-policy";

export const ACCESS_CONTROL = Symbol("ACCESS_CONTROL");

export interface AccessDecisionInput {
  operator: Pick<Operator, "id" | "role" | "sessionId">;
  organizationId: string;
  permission: PermissionKey;
  teamId: string | null;
}

/** The business-access decision the guard asks for on a permission route. */
export interface AccessControl {
  can(input: AccessDecisionInput): Promise<boolean>;
}
