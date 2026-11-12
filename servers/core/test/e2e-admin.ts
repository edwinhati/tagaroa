import { E2E_ADMIN, e2eOperator } from "@repo/test-support/e2e-stack";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import { createAuthRepository } from "../src/modules/auth/infrastructure/persistence/auth.persistence.module";
import * as schema from "../src/schema.registry";
import { testEnv } from "./database";

/**
 * The one account the product has no flow for. Every other e2e account is
 * issued by this one through `/admin/create-user`, the way a real one is.
 */
const e2eAdmin = { ...E2E_ADMIN, name: "E2E Admin" };

/** A super administrator no test signs in as or changes. */
const e2eGuardian = {
  email: "e2e-guardian@tagaroa.test",
  name: "E2E Guardian",
  password: "e2e-guardian-password-12",
};

/**
 * A parallel browser suite seeds one operator per Playwright worker (`E2E_OPERATORS`) so the tests that
 * change an operator's MFA, role or sessions never share one.
 */
const operatorFor = (index: number) => ({
  ...e2eAdmin,
  ...e2eOperator(index),
});

/**
 * Seeded through a throwaway auth instance rather than the service's own: the
 * product closes `/sign-up/email` everywhere, and this is the account that
 * would otherwise have nobody to issue it.
 */
export async function seedE2eAdmin(): Promise<void> {
  const client = new SQL(testEnv.DATABASE_URL);
  const auth = betterAuth({
    baseURL: testEnv.BETTER_AUTH_URL,
    database: createAuthRepository(drizzle({ client, schema })).adapter,
    emailAndPassword: { enabled: true },
    plugins: [admin()],
    secret: testEnv.BETTER_AUTH_SECRET,
  });
  const { internalAdapter } = await auth.$context;

  // Tests promote an operator to super-admin and demote it again; the database
  // refuses to leave none, so this one stays. Kept, never replaced, for that reason.
  const guardian = await internalAdapter.findUserByEmail(e2eGuardian.email);
  const guardianId =
    guardian?.user.id ??
    (await auth.api.signUpEmail({ body: e2eGuardian })).user.id;
  await internalAdapter.updateUser(guardianId, {
    banned: false,
    role: "super-admin",
  });

  const operators = [
    e2eAdmin,
    ...Array.from({ length: Number(process.env.E2E_OPERATORS ?? 0) }, (_, i) =>
      operatorFor(i),
    ),
  ];
  for (const operator of operators) {
    // Replaced rather than reused: a half-written account from an interrupted
    // run would otherwise survive every later start, signing in with no
    // password.
    const existing = await internalAdapter.findUserByEmail(operator.email);
    if (existing) await internalAdapter.deleteUser(existing.user.id);

    const { user } = await auth.api.signUpEmail({ body: operator });
    await internalAdapter.updateUser(user.id, { role: "admin" });
  }

  await client.close();
}
