import { randomBytes } from "node:crypto";

import { isSuperAdmin } from "@repo/contracts/identity";
import { SQL } from "bun";

import { auth } from "../src/modules/auth/auth.bootstrap";
import { validateEnv } from "../src/platform/config/env";

/**
 * Creates the first super-admin: the one account the product has no flow for,
 * since every other account is issued by an administrator. Run once per
 * environment:
 *
 *   bun scripts/bootstrap-admin.ts <email>
 *
 * The account starts on a random temporary password (printed once) that must be
 * replaced at first sign-in; privileged roles are then held to MFA enrolment by
 * the admin policy before they can use administration.
 */
async function main(email: string | undefined) {
  if (!email?.includes("@"))
    throw new Error("Usage: bootstrap-admin.ts <email>");

  const client = new SQL(validateEnv(process.env).DATABASE_URL);
  try {
    const roles: { role: string | null }[] =
      await client`select role from auth."user"`;
    if (roles.some((row) => isSuperAdmin(row.role)))
      throw new Error("A super-admin already exists; nothing to bootstrap.");
  } finally {
    await client.close();
  }

  // Better Auth's own create-user API, called as the service (no session, as
  // `AccountLifecycleFacade` does): its hasher writes the credential sign-in
  // verifies, and its after-hook marks the password temporary and the email
  // verified. No onboarding message is sent; that is a Nest hook on the HTTP
  // route. The required personal address is a placeholder for the same reason.
  const password = randomBytes(18).toString("base64url");
  const created = await auth.api.createUser({
    body: {
      data: { personalEmail: "bootstrap@bootstrap.invalid" },
      email: email.trim().toLowerCase(),
      name: "Super Admin",
      password,
      role: "super-admin",
    },
  });

  console.log(`Created super-admin ${created.user.email}`);
  console.log(`Temporary password (shown once, valid 24h): ${password}`);
}

void main(process.argv[2]).then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed.");
    process.exit(1);
  },
);
