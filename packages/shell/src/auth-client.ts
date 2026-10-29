import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import {
  defaultAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";
import { createAuthClient } from "better-auth/react";

const reviewerAc = defaultAc.newRole({
  session: ["list"],
  user: ["list", "get"],
});
const helpdeskAc = defaultAc.newRole({
  session: ["list", "revoke", "delete"],
  user: ["list", "get", "set-password"],
});
const identityAdminAc = defaultAc.newRole({
  session: ["list", "revoke", "delete"],
  user: ["create", "list", "ban", "set-password", "set-email", "get", "update"],
});
const superAdminAc = defaultAc.newRole({
  session: [...defaultStatements.session],
  user: [...defaultStatements.user],
});

/**
 * Reads the session the door (`apps/auth`) established. Same core service, same
 * plugin list as the server's createAuth() — this app only reads and ends a
 * session, it never creates one.
 */
export const authClient = createAuthClient({
  fetchOptions: { timeout: 20_000 },
  baseURL: import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8080",
  // teams.enabled mirrors the server: without it the client has no
  // team endpoints, and the domain rule has nothing to read.
  plugins: [
    organizationClient({ teams: { enabled: true } }),
    adminClient({
      roles: {
        "access-reviewer": reviewerAc,
        admin: identityAdminAc,
        helpdesk: helpdeskAc,
        "super-admin": superAdminAc,
        user: userAc,
      },
    }),
    twoFactorClient(),
    passkeyClient(),
  ],
});
