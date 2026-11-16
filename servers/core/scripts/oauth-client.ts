import { isSuperAdmin } from "@repo/contracts/identity";

import { auth } from "../src/modules/auth/auth.bootstrap";
import { registerOAuthClient } from "../src/modules/auth/oauth-clients";

/**
 * Registers an app that signs in with Tagaroa (OIDC), such as NetBird:
 *
 *   bun scripts/oauth-client.ts <super-admin-email> <name> <redirect-uri>... [--logout <post-logout-redirect-uri>...]
 *
 * The super-admin owns the client. Its secret is printed once: put it straight
 * into the app's settings. `--logout` names where the app may send people back
 * after they sign out (NetBird: `https://vpn.tagaroa.cc/oauth2/logout/callback`).
 */
const USAGE =
  "Usage: oauth-client.ts <super-admin-email> <name> <redirect-uri>... [--logout <post-logout-redirect-uri>...]";

async function main([email, name, ...uris]: string[]) {
  const at = uris.indexOf("--logout");
  const redirectUris = at < 0 ? uris : uris.slice(0, at);
  const logoutUris = at < 0 ? [] : uris.slice(at + 1);
  if (
    !email?.includes("@") ||
    !name ||
    redirectUris.length === 0 ||
    (at >= 0 && logoutUris.length === 0)
  )
    throw new Error(USAGE);

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
    logoutUris,
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
