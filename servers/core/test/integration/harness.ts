import { afterAll, beforeAll, expect, setDefaultTimeout } from "bun:test";

import { type INestApplication } from "@nestjs/common";
import { authenticatorCode } from "@repo/test-support/totp";
import { betterAuth } from "better-auth/minimal";
import { admin, testUtils } from "better-auth/plugins";

import { createAuthRepository } from "../../src/modules/auth/infrastructure/persistence/auth.persistence.module";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

export let app: INestApplication;
export let baseURL: string;

/** One core app per test file, on a migrated test database, closed once at the end. */
export function serveCore(): void {
  let databaseCloseCalls = 0;
  Object.assign(process.env, testEnv);
  setDefaultTimeout(60_000);

  beforeAll(async () => {
    await prepareTestDatabase();
    const { createApplication } = await import("../../src/application");
    app = await createApplication();
    const client = app.get<Database>(DATABASE).$client;
    const end = client.end.bind(client);
    client.end = async (options) => {
      databaseCloseCalls += 1;
      await end(options);
    };
    await app.listen(0, "127.0.0.1");
    baseURL = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    expect(databaseCloseCalls).toBe(1);
  });
}

export const request = (path: string, init?: RequestInit) =>
  fetch(`${baseURL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3001",
      ...init?.headers,
    },
  });

export const sessionCookie = (response: Response) =>
  response.headers.get("set-cookie")?.split(";", 1)[0];

/**
 * Nobody registers, so every fixture account starts the way a real one does: an
 * admin issues it. The admin itself is seeded straight into the database, which
 * is the one account the product has no flow for.
 */
export const adminCookie = async (
  role = "admin",
  mfa = true,
  existingUserId?: string,
): Promise<string> => {
  const auth = betterAuth({
    baseURL: testEnv.BETTER_AUTH_URL,
    database: createAuthRepository(app.get<Database>(DATABASE)).adapter,
    plugins: [admin(), testUtils()],
    secret: testEnv.BETTER_AUTH_SECRET,
  });
  const helpers = (await auth.$context).test;
  if (existingUserId)
    return (await helpers.login({ userId: existingUserId })).headers.get(
      "cookie",
    )!;
  const user = helpers.createUser({
    email: `admin-${crypto.randomUUID()}@tagaroa.test`,
    name: "Integration Admin",
    role,
  });
  await helpers.saveUser(user);
  await app.get<Database>(DATABASE).$client`
    update auth."user" set two_factor_enabled = ${mfa} where id = ${user.id}
  `;
  return (await helpers.login({ userId: user.id })).headers.get("cookie")!;
};

/** Mints an employee through the admin endpoint and returns its credentials. */
export const issueAccount = async (temporaryPassword: string) => {
  const email = `employee-${crypto.randomUUID()}@tagaroa.test`;
  const created = await request("/api/auth/admin/create-user", {
    method: "POST",
    headers: { cookie: await adminCookie() },
    body: JSON.stringify({
      email,
      name: "Integration Employee",
      password: temporaryPassword,
      data: { personalEmail: `personal.${email}` },
    }),
  });
  expect(created.status).toBe(200);
  expect((await created.json()).user.mustChangePassword).toBe(true);
  return { email, password: temporaryPassword };
};

export const signIn = (email: string, password: string) =>
  request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

/** Carries the session, challenge and trusted-device cookies between requests. */
export const cookieJar = () => {
  const cookies = new Map<string, string>();
  const header = () =>
    [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  return {
    header,
    has: (name: string) => cookies.has(`better-auth.${name}`),
    post: async (path: string, body: unknown) => {
      const response = await request(path, {
        method: "POST",
        headers: { cookie: header() },
        body: JSON.stringify(body),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair = "", ...attributes] = cookie.split(";");
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator).trim();
        if (attributes.some((attribute) => /^\s*max-age=0$/i.test(attribute)))
          cookies.delete(name);
        else cookies.set(name, pair.slice(separator + 1));
      }
      return response;
    },
  };
};

export const startEnrolment = async (temporaryPassword: string) => {
  const employee = await issueAccount(temporaryPassword);
  await app.get<Database>(DATABASE).$client`
    update auth."user" set must_change_password = false where email = ${employee.email}
  `;
  const jar = cookieJar();
  await jar.post("/api/auth/sign-in/email", employee);
  const enable = async () => {
    const enabled = await jar.post("/api/auth/two-factor/enable", {
      password: employee.password,
      method: "totp",
    });
    expect(enabled.status).toBe(200);
    return (await enabled.json()) as { totpURI: string; backupCodes: string[] };
  };
  return { employee, jar, enable };
};

export const enrolledEmployee = async (temporaryPassword: string) => {
  const { employee, jar, enable } = await startEnrolment(temporaryPassword);
  const factor = await enable();
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(factor.totpURI),
  });
  expect(verified.status).toBe(200);
  return { ...employee, ...factor };
};

/** Signs in with a password and expects the second-factor challenge. */
export const challenge = async (
  employee: { email: string; password: string },
  jar = cookieJar(),
) => {
  const signed = await jar.post("/api/auth/sign-in/email", employee);
  expect(signed.status).toBe(200);
  expect((await signed.json()).twoFactorRedirect).toBe(true);
  return jar;
};

export const userIdOf = async (email: string): Promise<string> =>
  (
    await app.get<Database>(DATABASE).$client`
      select id from auth."user" where email = ${email}`
  )[0].id;

export const sessionUserId = async (cookie: string): Promise<string> =>
  (
    await (
      await request("/api/auth/get-session", { headers: { cookie } })
    ).json()
  ).user.id;

/** The signed token a session cookie carries, sent the way the door's fallback sends it. */
export const bearerOf = (cookie: string): string => {
  const pair = cookie
    .split("; ")
    .find((part) => part.startsWith("better-auth.session_token="))!;
  return `Bearer ${decodeURIComponent(pair.slice(pair.indexOf("=") + 1))}`;
};

export const impersonationCookie = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0]!)
    .filter((pair) => !pair.endsWith("="))
    .join("; ");
