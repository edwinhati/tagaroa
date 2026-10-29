import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "../domain/access-policy";

export const REQUIRED_PERMISSION = Symbol("REQUIRED_PERMISSION");

export interface RequiredPermission {
  organizationParam: string;
  permission: PermissionKey;
  teamParam?: string;
}

export const RequiresPermission = (requirement: RequiredPermission) =>
  SetMetadata(REQUIRED_PERMISSION, requirement);
