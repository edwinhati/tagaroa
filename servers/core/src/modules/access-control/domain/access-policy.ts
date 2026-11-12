import {
  ACCESS_SCOPE_TYPES,
  type AccessScopeType,
  PERMISSION_CATALOG,
  type PermissionKey,
} from "@repo/contracts/access-control";

export const scopesForPermissions = (
  permissions: readonly PermissionKey[],
): AccessScopeType[] => {
  if (permissions.length === 0) return [];
  return ACCESS_SCOPE_TYPES.filter((scope) =>
    permissions.every((permission) =>
      PERMISSION_CATALOG[permission].scopes.includes(scope as never),
    ),
  );
};

export const permissionsArePrivileged = (
  permissions: readonly PermissionKey[],
): boolean =>
  permissions.some((permission) => PERMISSION_CATALOG[permission].privileged);
