import {
  ACCESS_SCOPE_TYPES,
  type AccessScopeType,
  type PermissionDefinition,
} from "@repo/contracts/access-control";

export const PERMISSION_CATALOG = {
  "domain:administer": {
    breakGlass: true,
    description: "Change configuration owned by a working domain.",
    key: "domain:administer",
    label: "Administer domain configuration",
    privileged: true,
    scopes: ["subsidiary", "team"],
  },
} as const satisfies Record<string, PermissionDefinition>;

export type PermissionKey = keyof typeof PERMISSION_CATALOG;

export const isPermissionKey = (value: string): value is PermissionKey =>
  Object.hasOwn(PERMISSION_CATALOG, value);

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
