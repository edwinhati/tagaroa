import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";

import type { INestApplication } from "@nestjs/common";
import { betterAuth } from "better-auth/minimal";
import { admin, testUtils } from "better-auth/plugins";

import { createAuthRepository } from "../../src/modules/auth/infrastructure/persistence/auth.persistence.module";
import {
  DATABASE,
  type Database,
} from "../../src/shared/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

Object.assign(process.env, testEnv);
setDefaultTimeout(60_000);

let app: INestApplication;
let baseURL: string;
let databaseCloseCalls = 0;

beforeAll(async () => {
  await prepareTestDatabase();
  const { createApplication } = await import("../../src/application");
  app = await createApplication();
  const client = app.get<Database>(DATABASE).$client;
  const close = client.close.bind(client);
  client.close = async (options) => {
    databaseCloseCalls += 1;
    await close(options);
  };
  await app.listen(0, "127.0.0.1");
  baseURL = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  expect(databaseCloseCalls).toBe(1);
});

const request = (path: string, init?: RequestInit) =>
  fetch(`${baseURL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3001",
      ...init?.headers,
    },
  });

const sessionCookie = (response: Response) =>
  response.headers.get("set-cookie")?.split(";", 1)[0];

/**
 * Nobody registers, so every fixture account starts the way a real one does: an
 * admin issues it. The admin itself is seeded straight into the database, which
 * is the one account the product has no flow for.
 */
const adminCookie = async (): Promise<string> => {
  const auth = betterAuth({
    baseURL: testEnv.BETTER_AUTH_URL,
    database: createAuthRepository(app.get<Database>(DATABASE)).adapter,
    plugins: [admin(), testUtils()],
    secret: testEnv.BETTER_AUTH_SECRET,
  });
  const helpers = (await auth.$context).test;
  const user = helpers.createUser({
    email: `admin-${crypto.randomUUID()}@tagaroa.test`,
    name: "Integration Admin",
    role: "admin",
  });
  await helpers.saveUser(user);
  return (await helpers.login({ userId: user.id })).headers.get("cookie")!;
};

/** Mints an employee through the admin endpoint and returns its credentials. */
const issueAccount = async (temporaryPassword: string) => {
  const email = `employee-${crypto.randomUUID()}@tagaroa.test`;
  const created = await request("/api/auth/admin/create-user", {
    method: "POST",
    headers: { cookie: await adminCookie() },
    body: JSON.stringify({
      email,
      name: "Integration Employee",
      password: temporaryPassword,
      role: "user",
    }),
  });
  expect(created.status).toBe(200);
  expect((await created.json()).user.mustChangePassword).toBe(true);
  return { email, password: temporaryPassword };
};

const signIn = (email: string, password: string) =>
  request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

test("reports core service liveness", async () => {
  const response = await request("/api/health/live");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("reports core service readiness", async () => {
  const response = await request("/api/health/ready");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("refuses to register an account", async () => {
  const response = await request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      email: `stranger-${crypto.randomUUID()}@tagaroa.test`,
      name: "Stranger",
      password: "stranger-password-12",
    }),
  });

  expect(response.status).toBe(400);
  expect((await response.json()).code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
});

test("an issued account can sign in, sign out, and sign back in", async () => {
  const issued = await issueAccount("issued-password-12");
  const settledPassword = "settled-password-12";

  const first = await signIn(issued.email, issued.password);
  expect(first.status).toBe(200);
  const cookie = sessionCookie(first);
  expect(cookie).toBeDefined();

  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { cookie: cookie! },
    body: JSON.stringify({
      currentPassword: issued.password,
      newPassword: settledPassword,
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);

  const settledCookie = sessionCookie(changed) ?? cookie!;
  const session = await request("/api/auth/get-session", {
    headers: { cookie: settledCookie },
  });
  expect((await session.json()).user.email).toBe(issued.email);

  const signOut = await request("/api/auth/sign-out", {
    method: "POST",
    headers: { cookie: settledCookie },
  });
  expect(signOut.status).toBe(200);

  const again = await signIn(issued.email, settledPassword);
  expect(again.status).toBe(200);
  expect(again.headers.get("set-cookie")).toContain("session_token");
});

test("an admin-issued password must be replaced", async () => {
  const issuedPassword = "issued-password-12";
  const replacementPassword = "replacement-password-12";
  const issued = await issueAccount(issuedPassword);

  const signedIn = await signIn(issued.email, issuedPassword);
  expect(signedIn.status).toBe(200);
  const employeeCookie = sessionCookie(signedIn);
  expect(employeeCookie).toBeDefined();

  // ADR-0001: the flag is not a browser-side hint. Until the password is
  // replaced, the session is refused everywhere outside the auth routes.
  const blocked = await request("/api/health/live", {
    headers: { cookie: employeeCookie! },
  });
  expect(blocked.status).toBe(403);
  expect((await blocked.json()).code).toBe("MUST_CHANGE_PASSWORD");

  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { cookie: employeeCookie! },
    body: JSON.stringify({
      currentPassword: issuedPassword,
      newPassword: replacementPassword,
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);
  expect((await changed.json()).user.mustChangePassword).toBe(false);

  const oldPassword = await signIn(issued.email, issuedPassword);
  expect(oldPassword.status).toBe(401);

  const newPassword = await signIn(issued.email, replacementPassword);
  expect(newPassword.status).toBe(200);
});

test("a fourth sign-in ends the oldest session", async () => {
  const issued = await issueAccount("issued-password-12");

  const cookies: string[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await signIn(issued.email, issued.password);
    expect(response.status).toBe(200);
    cookies.push(sessionCookie(response)!);
  }

  const revoked = await request("/api/auth/get-session", {
    headers: { cookie: cookies[0]! },
  });
  expect(await revoked.json()).toBeNull();

  const newest = await request("/api/auth/get-session", {
    headers: { cookie: cookies[3]! },
  });
  expect((await newest.json()).user.email).toBe(issued.email);
});
