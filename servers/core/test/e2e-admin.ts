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
 * `apps/auth/e2e` repeats these two values; they are fixtures, not secrets.
 */
const e2eAdmin = {
  email: "e2e-admin@tagaroa.test",
  name: "E2E Admin",
  password: "e2e-admin-password-12",
};

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

  // Replaced rather than reused: a half-written account from an interrupted run
  // would otherwise survive every later start, signing in with no password.
  const existing = await internalAdapter.findUserByEmail(e2eAdmin.email);
  if (existing) await internalAdapter.deleteUser(existing.user.id);

  const { user } = await auth.api.signUpEmail({ body: e2eAdmin });
  await internalAdapter.updateUser(user.id, { role: "admin" });

  await client.close();
}
