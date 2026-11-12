import { passkeyClient } from "@better-auth/passkey/client";
import { IDENTITY_ROLES } from "@repo/contracts/identity";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { defaultAc } from "better-auth/plugins/admin/access";
import { createAuthClient } from "better-auth/react";

const roles = Object.fromEntries(
  IDENTITY_ROLES.map(({ id, permissions }) => [
    id,
    defaultAc.newRole({
      session: [...permissions.session],
      user: [...permissions.user],
    }),
  ]),
);

/**
 * A Better Auth client with the server's plugin list (`createAuth()` in
 * servers/core). `teams` mirrors the server: without it the client has no team
 * endpoints. The door passes its own base URL; every other app reads core.
 */
export const createWorkspaceAuthClient = (baseURL: string) =>
  createAuthClient({
    fetchOptions: { timeout: 20_000 },
    baseURL,
    plugins: [
      organizationClient({ teams: { enabled: true } }),
      adminClient({ roles }),
      twoFactorClient(),
      passkeyClient(),
    ],
  });

export type WorkspaceAuthClient = ReturnType<typeof createWorkspaceAuthClient>;

/** One signed-in device, as Better Auth lists them. */
export type AuthSession = WorkspaceAuthClient["$Infer"]["Session"]["session"];
