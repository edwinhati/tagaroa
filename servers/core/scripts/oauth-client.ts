import { isSuperAdmin } from "@repo/contracts/identity";

import { auth } from "../src/modules/auth/auth.bootstrap";
import { registerOAuthClient } from "../src/modules/auth/oauth-clients";

/**
 * Registers an app that signs in with Tagaroa (OIDC), such as NetBird:
 *
 *   bun scripts/oauth-client.ts <super-admin-email> <name> <redirect-uri>...
 *
 * The super-admin owns the client. Its secret is printed once: put it straight
 * into the app's settings.
 */
async function main([email, name, ...redirectUris]: string[]) {
  if (!email?.includes("@") || !name || redirectUris.length === 0)
    throw new Error(
      "Usage: oauth-client.ts <super-admin-email> <name> <redirect-uri>...",
    );

  const context = await auth.$context;
  const owner = await context.internalAdapter.findUserByEmail(
    email.trim().toLowerCase(),
  );
  const role = (owner?.user as { role?: string | null } | undefined)?.role;
  if (!owner || !isSuperAdmin(role))
    throw new Error(`${email} is not a super-admin.`);

  const client = await registerOAuthClient(
    auth,
    owner.user.id,
    name,
    redirectUris,
  );
  console.log(`Registered ${name}`);
  console.log(`Client ID: ${client.client_id}`);
  console.log(`Client secret (shown once): ${client.client_secret}`);
}

void main(process.argv.slice(2)).then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Registration failed.",
    );
    process.exit(1);
  },
);
