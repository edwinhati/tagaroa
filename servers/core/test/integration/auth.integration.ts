import {
  afterAll,
  beforeAll,
  expect,
  setDefaultTimeout,
  spyOn,
  test,
} from "bun:test";
import { createHmac } from "node:crypto";

import { Logger, type INestApplication } from "@nestjs/common";
import { authenticatorCode } from "@repo/test-support/totp";
import { betterAuth } from "better-auth/minimal";
import { admin, testUtils } from "better-auth/plugins";

import { createAuthRepository } from "../../src/modules/auth/infrastructure/persistence/auth.persistence.module";
import { OnboardingHook } from "../../src/modules/auth/onboarding.hook";
import {
  NOTIFICATION_SENDER,
  type NotificationSender,
} from "../../src/modules/notification/application/notification.facade";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
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
const adminCookie = async (
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
const issueAccount = async (temporaryPassword: string) => {
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

const signIn = (email: string, password: string) =>
  request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

test("TOTP accepts adjacent windows at rollover and rejects two-window drift", async () => {
  const employee = await issueAccount("QaBoundaryPassword123!");
  const client = app.get<Database>(DATABASE).$client;
  await client`update auth."user" set must_change_password = false where email = ${employee.email}`;
  let cookie = sessionCookie(await signIn(employee.email, employee.password))!;
  const enabled = await request("/api/auth/two-factor/enable", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ password: employee.password, method: "totp" }),
  });
  expect(enabled.status).toBe(200);
  const { totpURI } = await enabled.json();
  const boundary = Math.floor(Date.now() / 30_000) * 30_000;
  const now = spyOn(Date, "now");
  try {
    for (const [time, offset, status] of [
      [boundary + 29_999, -2, 401],
      [boundary + 29_999, 2, 401],
      [boundary + 29_999, -1, 200],
      [boundary + 30_000, -1, 200],
      [boundary + 30_000, 0, 200],
      [boundary + 30_000, 1, 200],
    ] as const) {
      now.mockReturnValue(time);
      const verified = await request("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify({
          code: authenticatorCode(totpURI, time + offset * 30_000),
          trustDevice: false,
        }),
      });
      expect(verified.status).toBe(status);
      if (status === 401)
        expect((await verified.json()).code).toBe("INVALID_CODE");
      cookie = sessionCookie(verified) ?? cookie;
    }
  } finally {
    now.mockRestore();
  }
});

test("subsidiary and team rename, membership removal and team deletion persist while subsidiary deletion is refused", async () => {
  const cookie = await adminCookie("super-admin");
  const send = (path: string, body: unknown) =>
    request(path, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(body),
    });
  const subsidiary = await send("/api/auth-management/subsidiaries", {
    name: "QA CRUD",
    slug: `crud-${crypto.randomUUID()}`,
  });
  expect(subsidiary.status).toBe(201);
  const organizationId = (await subsidiary.json()).data.id;
  expect(
    (await send("/api/auth/organization/set-active", { organizationId }))
      .status,
  ).toBe(200);
  expect(
    (
      await send("/api/auth/organization/update", {
        organizationId,
        data: { name: "QA renamed" },
      })
    ).status,
  ).toBe(200);
  const team = await send(
    `/api/auth-management/subsidiaries/${organizationId}/teams`,
    { name: "QA team" },
  );
  expect(team.status).toBe(201);
  const teamId = (await team.json()).data.id;
  expect(
    (
      await send("/api/auth/organization/update-team", {
        teamId,
        data: { name: "QA renamed team" },
      })
    ).status,
  ).toBe(200);
  const employee = await issueAccount("QaMemberPassword123!");
  const login = await signIn(employee.email, employee.password);
  expect(login.status).toBe(200);
  const userId = (await login.json()).user.id;
  for (const deniedCookie of [
    await adminCookie("user"),
    await adminCookie("admin", false),
  ]) {
    expect(
      (
        await request(
          `/api/auth-management/subsidiaries/${organizationId}/members`,
          {
            method: "POST",
            headers: { cookie: deniedCookie },
            body: JSON.stringify({ userId, role: "member" }),
          },
        )
      ).status,
    ).toBe(403);
  }
  expect(
    (
      await send(
        `/api/auth-management/subsidiaries/${organizationId}/members`,
        { userId, role: "owner" },
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await send(
        `/api/auth-management/subsidiaries/${organizationId}/members`,
        { userId, role: "member" },
      )
    ).status,
  ).toBe(201);
  const membersPath = `/api/auth-management/subsidiaries/${organizationId}/members`;
  expect((await send(membersPath, { userId })).status).toBe(409);
  const racer = await issueAccount("QaRacerPassword123!");
  const racerId = (await (await signIn(racer.email, racer.password)).json())
    .user.id;
  const raced = await Promise.all([
    send(membersPath, { userId: racerId }),
    send(membersPath, { userId: racerId }),
  ]);
  expect(raced.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(
    (
      await app.get<Database>(DATABASE)
        .$client`select id from auth.member where organization_id = ${organizationId} and user_id = ${racerId}`
    ).length,
  ).toBe(1);
  expect(
    (await send("/api/auth/organization/add-team-member", { teamId, userId }))
      .status,
  ).toBe(200);
  expect(
    (
      await send("/api/auth/organization/remove-member", {
        organizationId,
        memberIdOrEmail: employee.email,
      })
    ).status,
  ).toBe(200);
  const sql = app.get<Database>(DATABASE).$client;
  expect(
    (
      await sql`select id from auth.team_member where team_id = ${teamId} and user_id = ${userId}`
    ).length,
  ).toBe(0);
  expect(
    (await sql`select name from auth.team where id = ${teamId}`)[0].name,
  ).toBe("QA renamed team");
  expect(
    (
      await sql`select name from auth.organization where id = ${organizationId}`
    )[0].name,
  ).toBe("QA renamed");
  expect(
    (await send("/api/auth/organization/remove-team", { teamId })).status,
  ).toBe(400);
  expect(
    (
      await send(`/api/auth-management/subsidiaries/${organizationId}/teams`, {
        name: "QA retained team",
      })
    ).status,
  ).toBe(201);
  expect(
    (await send("/api/auth/organization/remove-team", { teamId })).status,
  ).toBe(200);
  const deletion = await send("/api/auth/organization/delete", {
    organizationId,
  });
  expect(deletion.status).toBe(403);
  expect((await deletion.json()).code).toBe("ORGANIZATION_WRITE_NOT_AVAILABLE");
  for (const [path, body] of [
    [
      "/api/auth/organization/update-member-role",
      { memberId: userId, role: "owner", organizationId },
    ],
    [
      "/api/auth/organization/invite-member",
      { email: employee.email, role: "member", organizationId },
    ],
    [
      "/api/auth/organization/create-team",
      { name: "Unaudited team", organizationId },
    ],
  ] as const) {
    const refused = await send(path, body);
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe(
      "ORGANIZATION_WRITE_NOT_AVAILABLE",
    );
  }
  const trail = await sql`
    select type from directory.auth_audit_event
    where detail in (${organizationId}, ${teamId})
  `;
  expect(trail.map((row: { type: string }) => row.type)).toEqual(
    expect.arrayContaining([
      "subsidiary.updated",
      "team.updated",
      "team.removed",
    ]),
  );
  // The first removal was refused while the subsidiary had one team left.
  expect(
    trail.filter((row: { type: string }) => row.type === "team.removed"),
  ).toHaveLength(1);
  expect(
    (await sql`select id from auth.organization where id = ${organizationId}`)
      .length,
  ).toBe(1);
});

test("authenticated collections remain correct under 200 requests at concurrency 10", async () => {
  const cookie = await adminCookie();
  const durations: number[] = [];
  for (let batch = 0; batch < 20; batch += 1) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const started = performance.now();
        const response = await request(
          index % 2
            ? "/api/directory"
            : "/api/notifications/templates?limit=10",
          { headers: { cookie } },
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toBeDefined();
        durations.push(performance.now() - started);
      }),
    );
  }
  durations.sort((a, b) => a - b);
  console.info(
    `QA collection load: 200 requests, concurrency 10, p50=${durations[99]!.toFixed(1)}ms, p95=${durations[189]!.toFixed(1)}ms, max=${durations[199]!.toFixed(1)}ms`,
  );
});

test("authenticated sessions and collections survive a 60-second local soak", async () => {
  const cookie = await adminCookie();
  const paths = [
    "/api/directory",
    "/api/notifications/templates?limit=10",
    "/api/auth/get-session",
  ];
  for (const path of paths) {
    expect((await request(path, { headers: { cookie } })).status).toBe(200);
  }
  Bun.gc(true);
  const before = process.memoryUsage();
  const durations: number[] = [];
  let failures = 0;
  const started = performance.now();
  while (performance.now() - started < 60_000) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const requestStarted = performance.now();
        try {
          const response = await request(paths[index % paths.length]!, {
            headers: { cookie },
            signal: AbortSignal.timeout(5_000),
          });
          const body = await response.json();
          if (
            response.status !== 200 ||
            (index % paths.length === 2
              ? !body.user?.id
              : body.data === undefined)
          )
            failures += 1;
        } catch {
          failures += 1;
        }
        durations.push(performance.now() - requestStarted);
      }),
    );
    await Bun.sleep(100);
  }
  expect(failures).toBe(0);
  expect(durations.length).toBeGreaterThan(100);
  expect(
    (await request("/api/auth/get-session", { headers: { cookie } })).status,
  ).toBe(200);
  Bun.gc(true);
  const after = process.memoryUsage();
  durations.sort((a, b) => a - b);
  console.info(
    `QA local soak: ${durations.length} requests, concurrency 10, failures=${failures}, p95=${durations[Math.ceil(durations.length * 0.95) - 1]!.toFixed(1)}ms, rssDeltaMiB=${((after.rss - before.rss) / 1048576).toFixed(1)}, heapDeltaMiB=${((after.heapUsed - before.heapUsed) / 1048576).toFixed(1)}`,
  );
}, 90_000);

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

test("wrong credentials, suspension, restoration, and expired temporary passwords", async () => {
  const issued = await issueAccount("issued-password-12");
  expect((await signIn(issued.email, "wrong-password-12")).status).toBe(401);
  const operator = await adminCookie();
  const signedIn = await signIn(issued.email, issued.password);
  const userId = (await signedIn.json()).user.id;
  const cookie = sessionCookie(signedIn)!;
  const banned = await request("/api/auth/admin/ban-user", {
    method: "POST",
    headers: { cookie: operator },
    body: JSON.stringify({ userId, banReason: "Integration suspension" }),
  });
  expect(banned.status).toBe(200);
  expect((await signIn(issued.email, issued.password)).status).toBe(403);
  expect(
    await (
      await request("/api/auth/get-session", { headers: { cookie } })
    ).json(),
  ).toBeNull();
  expect(
    (
      await request("/api/auth/admin/unban-user", {
        method: "POST",
        headers: { cookie: operator },
        body: JSON.stringify({ userId }),
      })
    ).status,
  ).toBe(200);
  expect((await signIn(issued.email, issued.password)).status).toBe(200);
  await app.get<Database>(DATABASE).$client`
    update auth."user" set temporary_password_expires_at = now() - interval '1 second'
    where id = ${userId}
  `;
  const expired = await signIn(issued.email, issued.password);
  expect(expired.status).toBe(403);
  expect((await expired.json()).code).toBe("TEMPORARY_PASSWORD_EXPIRED");
});

test("ending other sessions preserves the current session and expired sessions are refused", async () => {
  const issued = await issueAccount("issued-password-12");
  const first = sessionCookie(await signIn(issued.email, issued.password))!;
  const second = sessionCookie(await signIn(issued.email, issued.password))!;
  const response = await request("/api/auth/revoke-other-sessions", {
    method: "POST",
    headers: { cookie: second },
    body: "{}",
  });
  expect(response.status).toBe(200);
  expect(
    await (
      await request("/api/auth/get-session", { headers: { cookie: first } })
    ).json(),
  ).toBeNull();
  const current = await (
    await request("/api/auth/get-session", { headers: { cookie: second } })
  ).json();
  expect(current.user.email).toBe(issued.email);
  await app.get<Database>(DATABASE).$client`
    update auth.session set expires_at = now() - interval '1 second' where id = ${current.session.id}
  `;
  expect(
    await (
      await request("/api/auth/get-session", { headers: { cookie: second } })
    ).json(),
  ).toBeNull();
});

test("operators never hold another person's session token, and a raw token is no bearer", async () => {
  const database = app.get<Database>(DATABASE).$client;
  const userOf = async (cookie: string): Promise<string> =>
    (
      await (
        await request("/api/auth/get-session", { headers: { cookie } })
      ).json()
    ).user.id;
  const sessionsOf = async (userId: string) =>
    database<{ id: string; token: string }[]>`
      select id, token from auth.session where user_id = ${userId}
    `;
  const helpdesk = await adminCookie("helpdesk");
  const superAdmin = await adminCookie("super-admin");
  const privileged = await adminCookie("super-admin");
  const privilegedId = await userOf(privileged);
  const listSessions = (cookie: string, userId: string) =>
    request("/api/auth/admin/list-user-sessions", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ userId }),
    });

  // Only a super administrator reads a privileged account's sessions, and
  // even then without the secret that signs in as them.
  expect((await listSessions(helpdesk, privilegedId)).status).toBe(403);
  const listed = await listSessions(superAdmin, privilegedId);
  expect(listed.status).toBe(200);
  const { sessions } = await listed.json();
  expect(sessions.length).toBeGreaterThan(0);
  expect(sessions.every((row: object) => !("token" in row))).toBe(true);

  // The stored token, unsigned, authenticates nowhere.
  const [stored] = await sessionsOf(privilegedId);
  const raw = { authorization: `Bearer ${stored!.token}` };
  expect(
    await (await request("/api/auth/get-session", { headers: raw })).json(),
  ).toBeNull();
  expect((await request("/api/directory", { headers: raw })).status).toBe(401);

  // The signed `set-auth-token` still carries the temporary-password flow.
  const issued = await issueAccount("bearer-password-12");
  const signedIn = await signIn(issued.email, issued.password);
  const signed = signedIn.headers.get("set-auth-token");
  expect(signed).toContain(".");
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { authorization: `Bearer ${signed}` },
    body: JSON.stringify({
      currentPassword: issued.password,
      newPassword: "bearer-replaced-12",
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);
  expect((await changed.json()).user.mustChangePassword).toBe(false);

  // Single-session revoke goes by id through core, checked against its owner.
  expect(
    (
      await request("/api/auth/admin/revoke-user-session", {
        method: "POST",
        headers: { cookie: superAdmin },
        body: JSON.stringify({ sessionToken: stored!.token }),
      })
    ).status,
  ).toBe(404);
  const revoke = (cookie: string, sessionId: string) =>
    request(`/api/auth-management/sessions/${sessionId}/revoke`, {
      method: "POST",
      headers: { cookie },
    });
  const denied = await revoke(helpdesk, stored!.id);
  expect(denied.status).toBe(403);
  expect((await denied.json()).code).toBe(
    "PRIVILEGED_TARGET_REQUIRES_SUPER_ADMIN",
  );
  expect(await sessionsOf(privilegedId)).toHaveLength(1);
  expect((await revoke(helpdesk, crypto.randomUUID())).status).toBe(404);

  const employeeId = (
    await (await signIn(issued.email, "bearer-replaced-12")).json()
  ).user.id;
  const [employeeSession] = await sessionsOf(employeeId);
  expect((await revoke(helpdesk, employeeSession!.id)).status).toBe(201);
  expect(
    (await sessionsOf(employeeId)).some(
      (row) => row.id === employeeSession!.id,
    ),
  ).toBe(false);
  const helpdeskId = await userOf(helpdesk);
  expect(
    await database`
      select detail from directory.auth_audit_event
      where actor_id = ${helpdeskId} and target_user_id = ${employeeId}
        and type = 'user.session.revoked'
    `,
  ).toEqual([{ detail: employeeSession!.id }]);
});

test("administration read and write endpoints enforce identity roles and MFA", async () => {
  for (const [role, readAllowed, writeAllowed] of [
    ["user", false, false],
    ["helpdesk", true, false],
    ["access-reviewer", true, false],
    ["admin", true, true],
    ["super-admin", true, true],
  ] as const) {
    const cookie = await adminCookie(role);
    expect(
      (await request("/api/directory", { headers: { cookie } })).status,
    ).toBe(readAllowed ? 200 : 403);
    const write = await request(
      `/api/directory/positions/group/missing-${crypto.randomUUID()}`,
      {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ title: "QA title" }),
      },
    );
    expect(write.status).toBe(writeAllowed ? 404 : 403);
  }
  const withoutMfa = await adminCookie("admin", false);
  const denied = await request("/api/directory", {
    headers: { cookie: withoutMfa },
  });
  expect(denied.status).toBe(403);
  expect((await denied.json()).code).toBe("PRIVILEGED_TWO_FACTOR_REQUIRED");
});

test("concurrent sign-ins retain at most three usable sessions", async () => {
  const issued = await issueAccount("concurrent-password-12");
  const responses = await Promise.all(
    Array.from({ length: 4 }, () => signIn(issued.email, issued.password)),
  );
  expect(responses.every((response) => response.status === 200)).toBe(true);
  const sessions = await Promise.all(
    responses.map(async (response) =>
      (
        await request("/api/auth/get-session", {
          headers: { cookie: sessionCookie(response)! },
        })
      ).json(),
    ),
  );
  expect(sessions.filter(Boolean)).toHaveLength(3);
  expect(
    sessions
      .filter(Boolean)
      .every((session) => session.user.email === issued.email),
  ).toBe(true);
});

test("concurrent sign-ins at the session cap evict the older sessions", async () => {
  const issued = await issueAccount("concurrent-cap-password-12");
  const older: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1)
    older.push(sessionCookie(await signIn(issued.email, issued.password))!);
  const newer = await Promise.all(
    Array.from({ length: 3 }, () => signIn(issued.email, issued.password)),
  );
  const live = async (cookie: string) =>
    Boolean(
      await (
        await request("/api/auth/get-session", { headers: { cookie } })
      ).json(),
    );
  expect(await Promise.all(older.map(live))).toEqual([false, false, false]);
  expect(
    await Promise.all(newer.map((response) => live(sessionCookie(response)!))),
  ).toEqual([true, true, true]);
  const [{ count }] = await app.get<Database>(DATABASE).$client`
    select count(*)::int as count from auth.session
    where user_id = (select id from auth."user" where email = ${issued.email})
  `;
  expect(count).toBe(3);
});

/** Carries the session, challenge and trusted-device cookies between requests. */
const cookieJar = () => {
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

const startEnrolment = async (temporaryPassword: string) => {
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

const enrolledEmployee = async (temporaryPassword: string) => {
  const { employee, jar, enable } = await startEnrolment(temporaryPassword);
  const factor = await enable();
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(factor.totpURI),
  });
  expect(verified.status).toBe(200);
  return { ...employee, ...factor };
};

/** Signs in with a password and expects the second-factor challenge. */
const challenge = async (
  employee: { email: string; password: string },
  jar = cookieJar(),
) => {
  const signed = await jar.post("/api/auth/sign-in/email", employee);
  expect(signed.status).toBe(200);
  expect((await signed.json()).twoFactorRedirect).toBe(true);
  return jar;
};

test("an abandoned authenticator enrolment leaves no half-enrolled factor", async () => {
  const { employee, jar, enable } = await startEnrolment(
    "QaAbandonPassword123!",
  );
  const abandoned = await enable();

  // Reloading before the first code is verified must not switch MFA on.
  const reloaded = await signIn(employee.email, employee.password);
  expect(reloaded.status).toBe(200);
  expect((await reloaded.json()).twoFactorRedirect).toBeUndefined();

  const resumed = await enable();
  expect(resumed.totpURI).not.toBe(abandoned.totpURI);
  expect(
    await app.get<Database>(DATABASE).$client`
      select verified from auth.two_factor
      where user_id = (select id from auth."user" where email = ${employee.email})
    `,
  ).toEqual([{ verified: false }]);
  const stale = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(abandoned.totpURI),
  });
  expect(stale.status).toBe(401);
  expect((await stale.json()).code).toBe("INVALID_CODE");
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(resumed.totpURI),
  });
  expect(verified.status).toBe(200);

  const pending = await challenge(employee);
  const staleCode = await pending.post(
    "/api/auth/two-factor/verify-backup-code",
    { code: abandoned.backupCodes[0] },
  );
  expect(staleCode.status).toBe(401);
  expect((await staleCode.json()).code).toBe("INVALID_BACKUP_CODE");
  const currentCode = await pending.post(
    "/api/auth/two-factor/verify-backup-code",
    { code: resumed.backupCodes[0] },
  );
  expect(currentCode.status).toBe(200);
});

test("exhausted recovery codes are refused and the authenticator still signs in", async () => {
  const employee = await enrolledEmployee("QaExhaustPassword123!");
  expect(employee.backupCodes).toHaveLength(10);
  for (const code of employee.backupCodes) {
    const used = await (
      await challenge(employee)
    ).post("/api/auth/two-factor/verify-backup-code", { code });
    expect(used.status).toBe(200);
  }

  // Five misses spend a challenge. The account locks after ten consecutive
  // misses, so an authenticator sign-in between the halves resets that count.
  for (const codes of [
    employee.backupCodes.slice(0, 5),
    employee.backupCodes.slice(5),
  ]) {
    const pending = await challenge(employee);
    for (const code of codes) {
      const reused = await pending.post(
        "/api/auth/two-factor/verify-backup-code",
        { code },
      );
      expect(reused.status).toBe(401);
      expect((await reused.json()).code).toBe("INVALID_BACKUP_CODE");
    }
    const spent = await pending.post("/api/auth/two-factor/verify-totp", {
      code: authenticatorCode(employee.totpURI),
    });
    expect(spent.status).toBe(400);
    expect((await spent.json()).code).toBe(
      "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
    );
    const recovered = await (
      await challenge(employee)
    ).post("/api/auth/two-factor/verify-totp", {
      code: authenticatorCode(employee.totpURI),
    });
    expect(recovered.status).toBe(200);
  }
});

test("trusted devices and pending challenges stop working once expired", async () => {
  const employee = await enrolledEmployee("QaExpiryPassword123!");
  const client = app.get<Database>(DATABASE).$client;
  const device = await challenge(employee);
  const trusted = await device.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
    trustDevice: true,
  });
  expect(trusted.status).toBe(200);
  expect(device.has("trust_device")).toBe(true);
  expect((await device.post("/api/auth/sign-out", {})).status).toBe(200);

  const skipped = await device.post("/api/auth/sign-in/email", employee);
  expect(skipped.status).toBe(200);
  expect((await skipped.json()).twoFactorRedirect).toBeUndefined();
  expect((await device.post("/api/auth/sign-out", {})).status).toBe(200);

  // Thirty days are simulated by ageing the server-side trust record.
  await client`
    update auth.verification set expires_at = now() - interval '1 second'
    where identifier like 'trust-device-%'
    and value = (select id from auth."user" where email = ${employee.email})
  `;
  const pending = await challenge(employee, device);
  await client`
    update auth.verification set expires_at = now() - interval '1 second'
    where value = (select id from auth."user" where email = ${employee.email})
    and identifier not like 'trust-device-%'
  `;
  const expired = await pending.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
  });
  expect(expired.status).toBe(401);
  expect((await expired.json()).code).toBe("INVALID_TWO_FACTOR_COOKIE");

  const fresh = await (
    await challenge(employee, pending)
  ).post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI),
  });
  expect(fresh.status).toBe(200);
});

test("template edits validate freshness and atomically reject concurrent overwrites", async () => {
  const cookie = await adminCookie();
  const draft = {
    key: `qa.concurrent.${crypto.randomUUID().replaceAll("-", "")}`,
    channel: "sms",
    locale: "en",
    subject: null,
    body: "Original wording",
    variables: [],
    secrets: [],
  };
  const created = await request("/api/notifications/templates", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify(draft),
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const client = app.get<Database>(DATABASE).$client;
  try {
    // JS reads millisecond precision; PostgreSQL defaults include microseconds.
    await client`update notification.template set updated_at = timestamp '2026-01-01 00:00:00.123456' where id = ${id}`;
    const path = `/api/notifications/templates/${id}`;
    for (const expectedUpdatedAt of [undefined, "not-a-date"]) {
      const invalid = await request(path, {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ ...draft, expectedUpdatedAt }),
      });
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).details).toEqual([
        {
          field: "expectedUpdatedAt",
          message: "expectedUpdatedAt must be a valid timestamp",
        },
      ]);
    }
    const expectedUpdatedAt = "2026-01-01T00:00:00.123Z";
    const responses = await Promise.all(
      ["First writer", "Second writer"].map((body) =>
        request(path, {
          method: "PUT",
          headers: { cookie },
          body: JSON.stringify({ ...draft, body, expectedUpdatedAt }),
        }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      204, 409,
    ]);
    const [stored] =
      await client`select body, updated_at from notification.template where id = ${id}`;
    const winner =
      responses[0]!.status === 204 ? "First writer" : "Second writer";
    expect(stored.body).toBe(winner);
    const obsolete = await request(path, {
      method: "PUT",
      headers: { cookie },
      body: JSON.stringify({ ...draft, expectedUpdatedAt }),
    });
    expect(obsolete.status).toBe(409);
    const fresh = await request(path, {
      method: "PUT",
      headers: { cookie },
      body: JSON.stringify({
        ...draft,
        body: "Fresh revision",
        expectedUpdatedAt: new Date(stored.updated_at).toISOString(),
      }),
    });
    expect(fresh.status).toBe(204);
    const [revised] =
      await client`select body, updated_at from notification.template where id = ${id}`;
    expect(revised.body).toBe("Fresh revision");
    expect(new Date(revised.updated_at).getTime()).toBeGreaterThan(
      new Date(stored.updated_at).getTime(),
    );
    const missing = await request(
      `/api/notifications/templates/${crypto.randomUUID()}`,
      {
        method: "PUT",
        headers: { cookie },
        body: JSON.stringify({ ...draft, expectedUpdatedAt }),
      },
    );
    expect(missing.status).toBe(404);
  } finally {
    await client`delete from notification.template where id = ${id}`;
  }
});

test("custom roles persist, reject duplicates and stale grants, and archive", async () => {
  const cookie = await adminCookie("super-admin");
  const input = {
    key: `qa-${crypto.randomUUID()}`,
    name: `QA ${crypto.randomUUID()}`,
    description: "Integration scope",
    permissions: ["domain:administer"],
  };
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const created = await send("/api/access-control/roles", "POST", input);
  expect(created.status).toBe(201);
  const { data: role } = await created.json();
  expect(role.key).toBe(input.key);
  expect((await send("/api/access-control/roles", "POST", input)).status).toBe(
    409,
  );
  const changed = await send(`/api/access-control/roles/${role.id}`, "PATCH", {
    ...input,
    name: `${input.name} revised`,
  });
  expect(changed.status).toBe(200);
  expect((await changed.json()).data.name).toBe(`${input.name} revised`);
  const session = await (
    await request("/api/auth/get-session", { headers: { cookie } })
  ).json();
  await app.get<Database>(DATABASE).$client`
    update auth.session set created_at = now() - interval '16 minutes' where id = ${session.session.id}
  `;
  expect(
    (await send(`/api/access-control/roles/${role.id}`, "DELETE")).status,
  ).toBe(403);
  await app.get<Database>(DATABASE).$client`
    update auth.session set created_at = now() where id = ${session.session.id}
  `;
  expect(
    (await send(`/api/access-control/roles/${role.id}`, "DELETE")).status,
  ).toBe(200);
  expect(
    (await send(`/api/access-control/roles/${role.id}`, "PATCH", input)).status,
  ).toBe(404);
});

test("templates validate and persist create, edit, publish, version and delete across channels", async () => {
  const cookie = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const empty = await send("/api/notifications/templates", "POST", {});
  expect(empty.status).toBe(400);
  expect(await empty.json()).toEqual({
    details: [
      { field: "key", message: "key is required" },
      {
        field: "channel",
        message: "channel is required",
      },
      { field: "body", message: "body is required" },
      { field: "locale", message: "locale is required" },
    ],
    error: "Bad Request",
    message: "key is required",
    statusCode: 400,
  });
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const key = `qa.${crypto.randomUUID().replaceAll("-", "")}`;
    const draft = {
      key,
      channel,
      locale: "en",
      body: channel === "whatsapp" ? "qa_welcome" : "Hello {{name}}",
      subject: "QA welcome",
      variables: ["name"],
      secrets: [],
    };
    const created = await send("/api/notifications/templates", "POST", draft);
    expect(created.status).toBe(201);
    const { id, version } = await created.json();
    expect(version).toBe(1);
    const initial = await (
      await send(`/api/notifications/templates?q=${key}`, "GET")
    ).json();
    const updatedAt = initial.data.find(
      (row: { id: string }) => row.id === id,
    ).updatedAt;
    expect(
      (
        await send(`/api/notifications/templates/${id}`, "PUT", {
          ...draft,
          expectedUpdatedAt: updatedAt,
          body: channel === "whatsapp" ? "qa_updated" : "Updated {{name}}",
        })
      ).status,
    ).toBe(204);
    const listed = await (
      await send(`/api/notifications/templates?q=${key}`, "GET")
    ).json();
    expect(listed.data.find((row: { id: string }) => row.id === id).body).toBe(
      channel === "whatsapp" ? "qa_updated" : "Updated {{name}}",
    );
    expect(
      (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
    ).toBe(204);
    expect(
      (
        await send(`/api/notifications/templates/${id}`, "PUT", {
          ...draft,
          expectedUpdatedAt: updatedAt,
        })
      ).status,
    ).toBe(404);
    expect(
      (await send(`/api/notifications/templates/${id}`, "DELETE")).status,
    ).toBe(404);
    const next = await send("/api/notifications/templates", "POST", draft);
    const nextDraft = await next.json();
    expect(nextDraft.version).toBe(2);
    expect(
      (await send(`/api/notifications/templates/${nextDraft.id}`, "DELETE"))
        .status,
    ).toBe(204);
  }
});

test("publishing wording and lifting a suppression each leave one audit row naming the operator", async () => {
  const cookie = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const operator = await (await send("/api/auth/get-session", "GET")).json();
  const key = `qa.${crypto.randomUUID().replaceAll("-", "")}`;
  const created = await send("/api/notifications/templates", "POST", {
    key,
    channel: "email",
    locale: "en",
    body: "Hello {{name}}",
    subject: "QA audit",
    variables: ["name"],
    secrets: [],
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
  ).toBe(204);

  const sql = app.get<Database>(DATABASE).$client;
  const suppressionId = crypto.randomUUID();
  const destination = `bounced-${suppressionId}@tagaroa.test`;
  await sql`
    insert into notification.suppression (id, channel, destination, reason)
    values (${suppressionId}, 'email', ${destination}, 'bounced')
  `;
  expect(
    (await send(`/api/notifications/suppressions/${suppressionId}`, "DELETE"))
      .status,
  ).toBe(204);

  const rows = await sql`
    select type, detail from directory.auth_audit_event
    where actor_id = ${operator.user.id}
      and type in ('notification.template.published', 'notification.suppression.removed')
  `;
  expect(rows).toHaveLength(2);
  expect(rows).toContainEqual({
    detail: `${key}:email:en:v1`,
    type: "notification.template.published",
  });
  expect(rows).toContainEqual({
    detail: `email:${suppressionId}`,
    type: "notification.suppression.removed",
  });
  // The trail names the act, never where the message would have gone.
  expect(JSON.stringify(rows)).not.toContain(destination);
});

test("a password-reset wording published without secrets still keeps the password out of the message log", async () => {
  const admin = await adminCookie();
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie: admin },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // The seeded wording, republished with nothing marked secret.
  const created = await send("/api/notifications/templates", "POST", {
    key: "account.password-reset",
    channel: "email",
    locale: "en",
    subject: "Your Tagaroa password was reset",
    body: "{{name}},\n\nAddress: {{email}}\nTemporary password: {{password}}",
    variables: ["name", "email", "password"],
    secrets: [],
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (await send(`/api/notifications/templates/${id}/publish`, "POST")).status,
  ).toBe(204);

  const employee = await issueAccount("UnmaskedFixturePassword123!");
  const target = await (await signIn(employee.email, employee.password)).json();
  const password = "UnmaskedResetFixture123!";
  const reset = await request("/api/auth/admin/set-user-password", {
    method: "POST",
    headers: { cookie: await adminCookie("super-admin") },
    body: JSON.stringify({ userId: target.user.id, newPassword: password }),
  });
  expect(reset.status).toBe(200);

  const listed = await send(
    `/api/notifications/messages?q=${encodeURIComponent(`personal.${employee.email}`)}`,
    "GET",
  );
  expect(listed.status).toBe(200);
  const messages = await listed.json();
  expect(
    messages.data.some(
      (row: { key: string; body: string }) =>
        row.key === "account.password-reset" &&
        row.body.includes("Temporary password: {{password}}"),
    ),
  ).toBe(true);
  expect(JSON.stringify(messages)).not.toContain(password);
});

test("subsidiaries, teams, positions, scoped assignments and emergency access persist", async () => {
  const cookie = await adminCookie("super-admin");
  const send = (path: string, method: string, body?: unknown) =>
    request(path, {
      method,
      headers: { cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const session = await (await send("/api/auth/get-session", "GET")).json();
  const userId = session.user.id;
  const invalid = await send("/api/auth-management/subsidiaries", "POST", {
    name: " ",
    slug: "Invalid slug",
  });
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toEqual({
    details: [
      { field: "name", message: "Name is required." },
      {
        field: "slug",
        message:
          "Slug must contain lowercase letters, numbers, and single hyphens only.",
      },
    ],
    error: "Bad Request",
    message: "Name is required.",
    statusCode: 400,
  });
  const subsidiary = await send("/api/auth-management/subsidiaries", "POST", {
    name: "QA scope",
    slug: `qa-${crypto.randomUUID()}`,
  });
  expect(subsidiary.status).toBe(201);
  const organizationId = (await subsidiary.json()).data.id;
  const team = await send(
    `/api/auth-management/subsidiaries/${organizationId}/teams`,
    "POST",
    { name: "Engineering" },
  );
  expect(team.status).toBe(201);
  const teamId = (await team.json()).data.id;
  const positionPath = `/api/directory/positions/group/${userId}`;
  expect(
    (await send(positionPath, "PUT", { title: "QA manager" })).status,
  ).toBe(200);
  expect(
    (
      await send(positionPath, "PUT", {
        title: "QA manager",
        managerUserId: userId,
      })
    ).status,
  ).toBe(400);
  expect((await send(positionPath, "PUT", { title: " " })).status).toBe(400);
  const colleague = await issueAccount("QaCyclePassword123!");
  const colleagueLogin = await signIn(colleague.email, colleague.password);
  expect(colleagueLogin.status).toBe(200);
  const colleagueId = (await colleagueLogin.json()).user.id;
  expect(
    (
      await send(positionPath, "PUT", {
        title: "QA manager",
        managerUserId: colleagueId,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await send(`/api/directory/positions/group/${colleagueId}`, "PUT", {
        title: "QA colleague",
        managerUserId: userId,
      })
    ).status,
  ).toBe(400);
  expect((await send(positionPath, "DELETE")).status).toBe(200);
  const own = `/api/access-control/me?organizationId=${organizationId}&teamId=${teamId}`;
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
  const input = {
    organizationId,
    teamId: null,
    scope: "subsidiary",
    roleId: "system-domain-administrator",
    userId,
  };
  const assignment = await send(
    "/api/access-control/assignments",
    "POST",
    input,
  );
  expect(assignment.status).toBe(201);
  const assignmentId = (await assignment.json()).data.id;
  const foreignSubsidiary = await send(
    "/api/auth-management/subsidiaries",
    "POST",
    {
      name: "Foreign scope",
      slug: `qa-foreign-${crypto.randomUUID()}`,
    },
  );
  expect(foreignSubsidiary.status).toBe(201);
  const foreignId = (await foreignSubsidiary.json()).data.id;
  const foreignTeam = await send(
    `/api/auth-management/subsidiaries/${foreignId}/teams`,
    "POST",
    { name: "Foreign team" },
  );
  expect(foreignTeam.status).toBe(201);
  const foreignTeamId = (await foreignTeam.json()).data.id;
  const mismatched = await send(
    `/api/access-control/me?organizationId=${organizationId}&teamId=${foreignTeamId}`,
    "GET",
  );
  expect(mismatched.status).toBe(200);
  expect((await mismatched.json()).data.permissions).toEqual([]);

  expect((await (await send(own, "GET")).json()).data.permissions).toContain(
    "domain:administer",
  );
  expect(
    (await send(`/api/access-control/assignments/${assignmentId}`, "DELETE"))
      .status,
  ).toBe(200);
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
  const sibling = await send(
    `/api/auth-management/subsidiaries/${organizationId}/teams`,
    "POST",
    { name: "QA sibling" },
  );
  expect(sibling.status).toBe(201);
  const siblingId = (await sibling.json()).data.id;
  expect(
    (
      await send("/api/auth/organization/set-active", "POST", {
        organizationId,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await send("/api/auth/organization/add-team-member", "POST", {
        teamId,
        userId,
      })
    ).status,
  ).toBe(200);
  const narrow = await send("/api/access-control/assignments", "POST", {
    ...input,
    scope: "team",
    teamId,
  });
  expect(narrow.status).toBe(201);
  const narrowId = (await narrow.json()).data.id;
  expect((await (await send(own, "GET")).json()).data.permissions).toContain(
    "domain:administer",
  );
  expect(
    (
      await (
        await send(
          `/api/access-control/me?organizationId=${organizationId}&teamId=${siblingId}`,
          "GET",
        )
      ).json()
    ).data.permissions,
  ).toEqual([]);
  expect(
    (
      await send("/api/auth/organization/remove-team-member", "POST", {
        teamId,
        userId,
      })
    ).status,
  ).toBe(200);
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
  expect(
    (
      await send("/api/auth/organization/add-team-member", "POST", {
        teamId,
        userId,
      })
    ).status,
  ).toBe(200);
  // Restoring membership does not revive the grant revoked on departure.
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
  expect(
    (await send(`/api/access-control/assignments/${narrowId}`, "DELETE"))
      .status,
  ).toBe(404);
  const elevationInput = {
    organizationId,
    teamId,
    scope: "team",
    permission: "domain:administer",
    reason: "QA emergency recovery",
  };
  expect(
    (
      await send("/api/access-control/break-glass", "POST", {
        ...elevationInput,
        reason: " ",
      })
    ).status,
  ).toBe(400);
  const elevation = await send(
    "/api/access-control/break-glass",
    "POST",
    elevationInput,
  );
  expect(elevation.status).toBe(201);
  const elevationId = (await elevation.json()).data.id;
  expect(
    (
      await (await send("/api/access-control/break-glass", "GET")).json()
    ).data.map((item: { id: string }) => item.id),
  ).toContain(elevationId);
  const otherSessionCookie = await adminCookie("super-admin", true, userId);
  const otherSession = await request("/api/access-control/break-glass", {
    headers: { cookie: otherSessionCookie },
  });
  expect(otherSession.status).toBe(200);
  expect((await otherSession.json()).data).toEqual([]);
  expect(
    (
      await request(`/api/access-control/break-glass/${elevationId}`, {
        method: "DELETE",
        headers: { cookie: otherSessionCookie },
      })
    ).status,
  ).toBe(404);
  expect((await (await send(own, "GET")).json()).data.permissions).toContain(
    "domain:administer",
  );
  const sql = app.get<Database>(DATABASE).$client;
  const auditEvents = await sql`
    select type from directory.auth_audit_event where actor_id = ${userId}
  `;
  expect(auditEvents.map((event: { type: string }) => event.type)).toContain(
    "access.break-glass.activated",
  );
  expect(auditEvents.map((event: { type: string }) => event.type)).toContain(
    "access.break-glass.used",
  );
  await sql`update access_control.break_glass_elevation set expires_at = now() - interval '1 second' where id = ${elevationId}`;
  expect(
    (await (await send("/api/access-control/break-glass", "GET")).json()).data,
  ).toEqual([]);
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
  await sql`update access_control.break_glass_elevation set expires_at = now() + interval '1 minute' where id = ${elevationId}`;
  expect(
    (await send(`/api/access-control/break-glass/${elevationId}`, "DELETE"))
      .status,
  ).toBe(200);
  expect((await (await send(own, "GET")).json()).data.permissions).toEqual([]);
});

test("concurrent template creation returns a saved draft or a retryable conflict", async () => {
  const cookie = await adminCookie();
  const draft = {
    key: `qa.${crypto.randomUUID().replaceAll("-", "")}`,
    channel: "email",
    locale: "en",
    body: "Concurrent draft",
    subject: "QA concurrency",
    variables: [],
    secrets: [],
  };
  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("/api/notifications/templates", {
        method: "POST",
        headers: { cookie },
        body: JSON.stringify(draft),
      }),
    ),
  );
  expect(responses.some((response) => response.status === 201)).toBe(true);
  for (const response of responses)
    expect([201, 409]).toContain(response.status);
});

test("webhooks verify original JSON bytes and reject altered or unsigned payloads", async () => {
  const raw = '{ "entry" : [] }';
  const signature = `sha256=${createHmac("sha256", testEnv.WHATSAPP_APP_SECRET).update(raw).digest("hex")}`;
  const signed = await request("/api/notifications/webhooks/meta", {
    method: "POST",
    headers: { "x-hub-signature-256": signature },
    body: raw,
  });
  expect(signed.status).toBe(204);
  expect(
    (
      await request("/api/notifications/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": signature },
        body: JSON.stringify({ entry: [] }),
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request("/api/notifications/webhooks/meta", {
        method: "POST",
        body: raw,
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request("/api/notifications/webhooks/unknown", {
        method: "POST",
        body: raw,
      })
    ).status,
  ).toBe(404);
});

test("super-admin impersonation restores the operator and deletion removes access", async () => {
  const issued = await issueAccount("issued-password-12");
  const initial = await signIn(issued.email, issued.password);
  const userId = (await initial.json()).user.id;
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { cookie: sessionCookie(initial)! },
    body: JSON.stringify({
      currentPassword: issued.password,
      newPassword: "private-password-12",
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);
  const operatorCookie = await adminCookie("super-admin");
  const operator = await (
    await request("/api/auth/get-session", {
      headers: { cookie: operatorCookie },
    })
  ).json();
  const impersonated = await request("/api/auth/admin/impersonate-user", {
    method: "POST",
    headers: { cookie: operatorCookie },
    body: JSON.stringify({ userId }),
  });
  expect(impersonated.status).toBe(200);
  const cookieJar = new Map(
    impersonated.headers.getSetCookie().map((value) => {
      const cookie = value.split(";", 1)[0]!;
      const separator = cookie.indexOf("=");
      return [cookie.slice(0, separator), cookie.slice(separator + 1)] as const;
    }),
  );
  const cookies = [...cookieJar]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  const session = await (
    await request("/api/auth/get-session", { headers: { cookie: cookies } })
  ).json();
  expect(session.user.id).toBe(userId);
  expect(session.session.impersonatedBy).toBe(operator.user.id);
  const impersonationEvents = await app.get<Database>(DATABASE).$client`
    select actor_id from directory.auth_audit_event where target_user_id = ${userId} and type = 'user.impersonated'
  `;
  expect(
    impersonationEvents.map((event: { actor_id: string }) => event.actor_id),
  ).toContain(operator.user.id);
  const stopped = await request("/api/auth/admin/stop-impersonating", {
    method: "POST",
    headers: { cookie: cookies },
    body: "{}",
  });
  expect(stopped.status).toBe(200);
  const restoredCookie = sessionCookie(stopped)!;
  expect(
    (
      await (
        await request("/api/auth/get-session", {
          headers: { cookie: restoredCookie },
        })
      ).json()
    ).user.id,
  ).toBe(operator.user.id);
  const deleted = await request("/api/auth/admin/remove-user", {
    method: "POST",
    headers: { cookie: restoredCookie },
    body: JSON.stringify({ userId }),
  });
  expect(deleted.status).toBe(200);
  expect((await signIn(issued.email, "private-password-12")).status).toBe(401);
});

test("password recovery, impersonation and deletion reject stale operator sessions", async () => {
  const cookie = await adminCookie("super-admin");
  const current = await (
    await request("/api/auth/get-session", { headers: { cookie } })
  ).json();
  const employee = await issueAccount("RecoveryGuardPassword123!");
  const target = await (await signIn(employee.email, employee.password)).json();
  await app.get<Database>(DATABASE)
    .$client`update auth.session set created_at = now() - interval '16 minutes' where id = ${current.session.id}`;
  for (const path of ["set-user-password", "impersonate-user", "remove-user"]) {
    const response = await request(`/api/auth/admin/${path}`, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({
        userId: target.user.id,
        newPassword: "ReplacementPassword123!",
      }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("SESSION_NOT_FRESH");
  }
  expect((await signIn(employee.email, employee.password)).status).toBe(200);
});

test("privileged access reviews require an independent reviewer and an active privileged target", async () => {
  const cookie = await adminCookie("access-reviewer");
  const self = await (
    await request("/api/auth/get-session", { headers: { cookie } })
  ).json();
  const review = (id: string) =>
    request(`/api/directory/access-reviews/${id}`, {
      method: "POST",
      headers: { cookie },
      body: "{}",
    });
  expect((await review(self.user.id)).status).toBe(403);
  expect((await review(`missing-${crypto.randomUUID()}`)).status).toBe(404);
  const targetCookie = await adminCookie("admin");
  const target = await (
    await request("/api/auth/get-session", {
      headers: { cookie: targetCookie },
    })
  ).json();
  expect((await review(target.user.id)).status).toBe(201);
  const [stored] = await app.get<Database>(DATABASE)
    .$client`select reviewed_by from directory.privileged_access_review where user_id = ${target.user.id}`;
  expect(stored.reviewed_by).toBe(self.user.id);
});

test("business reviews persist, reject stale and self decisions, and retain emergency history after session deletion", async () => {
  const cookie = await adminCookie("super-admin");
  const send = (path: string, body?: unknown, useCookie = cookie) =>
    request(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: useCookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const operator = await (await send("/api/auth/get-session")).json();
  const subsidiary = await send("/api/auth-management/subsidiaries", {
    name: "Review scope",
    slug: `review-${crypto.randomUUID()}`,
  });
  expect(subsidiary.status).toBe(201);
  const organizationId = (await subsidiary.json()).data.id;
  const assignment = await send("/api/access-control/assignments", {
    organizationId,
    scope: "subsidiary",
    roleId: "system-domain-administrator",
    userId: operator.user.id,
  });
  expect(assignment.status).toBe(201);
  const assignmentId = (await assignment.json()).data.id;
  const subjects = (await (await send("/api/access-control/reviews")).json())
    .data;
  const subject = subjects.find(
    (row: { id: string }) => row.id === assignmentId,
  );
  expect(subject.eligible).toBe(true);
  const input = {
    decision: "confirmed",
    note: "Manager confirmed responsibility in case 123",
    snapshot: subject.snapshot,
  };
  const path = `/api/access-control/reviews/assignment/${assignmentId}`;
  expect((await send(path, input)).status).toBe(403);
  const reviewer = await adminCookie("access-reviewer");
  expect(
    (await send(path, { ...input, snapshot: "outdated" }, reviewer)).status,
  ).toBe(409);
  expect((await send(path, input, reviewer)).status).toBe(201);
  const reviewed = (
    await (
      await send("/api/access-control/reviews", undefined, reviewer)
    ).json()
  ).data.find((row: { id: string }) => row.id === assignmentId);
  expect(reviewed.review.decision).toBe("confirmed");
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update access_control.access_assignment set expires_at = now() + interval '1 day' where id = ${assignmentId}`;
  const changed = (
    await (
      await send("/api/access-control/reviews", undefined, reviewer)
    ).json()
  ).data.find((row: { id: string }) => row.id === assignmentId);
  expect(changed.review).toBeNull();
  const activation = await send("/api/access-control/break-glass", {
    organizationId,
    scope: "subsidiary",
    permission: "domain:administer",
    reason: "Restore a reviewed configuration",
  });
  expect(activation.status).toBe(201);
  const elevationId = (await activation.json()).data.id;
  await sql`update access_control.break_glass_elevation set expires_at = now() - interval '1 second' where id = ${elevationId}`;
  await sql`delete from auth.session where id = ${operator.session.id}`;
  const retained = (
    await (
      await send("/api/access-control/reviews", undefined, reviewer)
    ).json()
  ).data.find((row: { id: string }) => row.id === elevationId);
  expect(retained.eligible).toBe(true);
  expect(
    (
      await send(
        `/api/access-control/reviews/emergency/${elevationId}`,
        { ...input, decision: "flagged", snapshot: retained.snapshot },
        reviewer,
      )
    ).status,
  ).toBe(201);
  const [stored] =
    await sql`select decision from access_control.access_review where subject_id = ${elevationId}`;
  expect(stored.decision).toBe("flagged");
});

test("domain links use immutable team ids, survive renames, and require current membership", async () => {
  const cookie = await adminCookie("super-admin");
  const send = (
    path: string,
    method = "GET",
    body?: unknown,
    authCookie = cookie,
  ) =>
    request(path, {
      method,
      headers: { cookie: authCookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const operator = await (await send("/api/auth/get-session")).json();
  const created = await send("/api/auth-management/subsidiaries", "POST", {
    name: "Bound domain",
    slug: `binding-${crypto.randomUUID()}`,
  });
  const organizationId = (await created.json()).data.id;
  const team = await send(
    `/api/auth-management/subsidiaries/${organizationId}/teams`,
    "POST",
    { name: "Engineering" },
  );
  const teamId = (await team.json()).data.id;
  expect(
    (
      await send("/api/auth/organization/set-active", "POST", {
        organizationId,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await send("/api/auth/organization/add-team-member", "POST", {
        teamId,
        userId: operator.user.id,
      })
    ).status,
  ).toBe(200);
  const mine = async () =>
    (await (await send("/api/access-control/domains")).json()).data.filter(
      (row: { teamId: string }) => row.teamId === teamId,
    );
  expect(await mine()).toEqual([]);
  const path = `/api/access-control/teams/${teamId}/domain`;
  const reviewer = await adminCookie("access-reviewer");
  expect(
    (await send(path, "PUT", { domainSlug: "engineering" }, reviewer)).status,
  ).toBe(403);
  expect((await send(path, "PUT", { domainSlug: "invented" })).status).toBe(
    400,
  );
  expect((await send(path, "PUT", { domainSlug: "engineering" })).status).toBe(
    200,
  );
  expect(
    (await mine()).map((row: { domainSlug: string }) => row.domainSlug),
  ).toEqual(["engineering"]);
  expect(
    (
      await send("/api/auth/organization/update-team", "POST", {
        teamId,
        data: { name: "Platform delivery" },
      })
    ).status,
  ).toBe(200);
  expect(
    (await mine()).map((row: { domainSlug: string }) => row.domainSlug),
  ).toEqual(["engineering"]);
  const foreign = await send(
    "/api/access-control/domains",
    "GET",
    undefined,
    reviewer,
  );
  expect((await foreign.json()).data).toEqual([]);
  expect(
    (
      await send("/api/auth/organization/remove-team-member", "POST", {
        teamId,
        userId: operator.user.id,
      })
    ).status,
  ).toBe(200);
  expect(await mine()).toEqual([]);
});

test("recovery delivery reports missing, suppressed and failed destinations without losing the handover outcome", async () => {
  const hook = app.get(OnboardingHook);
  const sender = app.get<NotificationSender>(NOTIFICATION_SENDER);
  const send = spyOn(sender, "send");
  const log = spyOn(Logger.prototype, "error").mockImplementation(() => {});
  const account = {
    email: "recovery@tagaroa.com",
    name: "Recovery fixture",
    personalEmail: "recovery@personal.example",
  };
  const password = "FixtureRecoveryPassword123!";
  try {
    expect(
      await hook.deliverRecoveryPassword(
        { ...account, personalEmail: null },
        password,
        "missing-address",
      ),
    ).toEqual({
      destination: null,
      queued: false,
      reason: "No personal address is on file",
    });
    expect(send).not.toHaveBeenCalled();

    send.mockResolvedValue({ id: "suppressed", status: "suppressed" });
    expect(
      await hook.deliverRecoveryPassword(account, password, "suppressed"),
    ).toEqual({
      destination: account.personalEmail,
      queued: false,
      reason: "That address is suppressed",
    });

    for (const failure of [new Error(`Queue rejected ${password}`), password]) {
      send.mockRejectedValue(failure);
      const outcome = await hook.deliverRecoveryPassword(
        account,
        password,
        "failed",
      );
      expect(outcome).toEqual({
        destination: account.personalEmail,
        queued: false,
        reason: "The notification could not be queued",
      });
      expect(JSON.stringify(outcome)).not.toContain(password);
      expect(JSON.stringify(log.mock.calls)).not.toContain(password);
    }
    expect(log).toHaveBeenCalledTimes(2);

    send.mockResolvedValue({ id: "queued", status: "queued" });
    expect(
      await hook.deliverRecoveryPassword(account, password, "queued"),
    ).toEqual({
      destination: account.personalEmail,
      queued: true,
    });
    expect(send).toHaveBeenLastCalledWith({
      channel: "email",
      key: "account.password-reset",
      to: account.personalEmail,
      variables: { email: account.email, name: account.name, password },
      idempotencyKey: "factor-recovery:queued",
    });
  } finally {
    send.mockRestore();
    log.mockRestore();
  }
});

test("factor recovery requires independent verification, replaces credentials once and revokes every old factor and session", async () => {
  const issued = await issueAccount("LostFactorsPassword123!");
  const login = await signIn(issued.email, issued.password);
  const person = await login.json();
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set must_change_password = false, two_factor_enabled = true, role = 'admin' where id = ${person.user.id}`;
  await sql`insert into auth.two_factor (id, user_id, secret, backup_codes) values (${crypto.randomUUID()}, ${person.user.id}, 'fixture-secret', 'fixture-backup')`;
  await sql`insert into auth.verification (id, identifier, value, expires_at, created_at, updated_at) values (${crypto.randomUUID()}, ${`trust-device-${crypto.randomUUID()}`}, ${person.user.id}, now() + interval '1 day', now(), now())`;
  await sql`insert into auth.passkey (id, user_id, public_key, credential_id, counter, device_type, backed_up) values (${crypto.randomUUID()}, ${person.user.id}, 'fixture-public-key', ${crypto.randomUUID()}, 0, 'singleDevice', false)`;
  const requester = await adminCookie("super-admin");
  const reviewer = await adminCookie("super-admin");
  const send = (path: string, body: unknown, cookie = requester) =>
    request(path, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(body),
    });
  const input = {
    reason: "Employee lost all authentication factors",
    evidence: "HR callback and manager verified; case REC-123",
    identityVerified: true,
  };
  const path = `/api/auth-management/users/${person.user.id}/factor-recovery`;
  expect((await send(path, { ...input, identityVerified: false })).status).toBe(
    400,
  );
  const requested = await send(path, input);
  expect(requested.status).toBe(201);
  const recoveryId = (await requested.json()).data.id;
  const approvePath = `/api/auth-management/recoveries/${recoveryId}/approve`;
  await sql`update auth.two_factor set failed_verification_count = 1 where user_id = ${person.user.id}`;
  expect((await send(approvePath, input)).status).toBe(403);
  expect(
    (await send(approvePath, input, await adminCookie("helpdesk"))).status,
  ).toBe(403);
  const approvals = await Promise.all([
    send(approvePath, input, reviewer),
    send(approvePath, input, reviewer),
  ]);
  expect(approvals.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(
    approvals
      .find((response) => response.status === 201)!
      .headers.get("cache-control"),
  ).toBe("no-store");
  const completed = await approvals
    .find((response) => response.status === 201)!
    .json();
  expect(completed.data.temporaryPassword.length).toBeGreaterThanOrEqual(24);
  expect((await signIn(issued.email, issued.password)).status).toBe(401);
  const replacement = await signIn(
    issued.email,
    completed.data.temporaryPassword,
  );
  expect(replacement.status).toBe(200);
  const recovered = await replacement.json();
  expect(recovered.user.mustChangePassword).toBe(true);
  expect(recovered.user.twoFactorEnabled).toBe(false);
  expect(
    await (
      await request("/api/auth/get-session", {
        headers: { cookie: sessionCookie(login)! },
      })
    ).json(),
  ).toBeNull();
  expect(
    await sql`select id from auth.two_factor where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from auth.verification where value = ${person.user.id}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from auth.passkey where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  const stored =
    await sql`select * from identity_operations.factor_recovery where id = ${recoveryId}`;
  expect(JSON.stringify(stored)).not.toContain(
    completed.data.temporaryPassword,
  );
  expect(stored[0].approved_by).toBeTruthy();
  const recoveredCookie = sessionCookie(replacement)!;
  expect(
    (await request("/api/directory", { headers: { cookie: recoveredCookie } }))
      .status,
  ).toBe(403);
  const changed = await request("/api/auth/change-password", {
    method: "POST",
    headers: { cookie: recoveredCookie },
    body: JSON.stringify({
      currentPassword: completed.data.temporaryPassword,
      newPassword: "RecoveredAdminPassword123!",
      revokeOtherSessions: true,
    }),
  });
  expect(changed.status).toBe(200);
  const stillBlocked = await request("/api/directory", {
    headers: { cookie: sessionCookie(changed) ?? recoveredCookie },
  });
  expect(stillBlocked.status).toBe(403);
  expect((await stillBlocked.json()).code).toBe(
    "PRIVILEGED_TWO_FACTOR_REQUIRED",
  );
});

test("stale recovery evidence cannot reset a changed account and a new verified request may replace it", async () => {
  const targetCookie = await adminCookie("admin");
  const person = await (
    await request("/api/auth/get-session", {
      headers: { cookie: targetCookie },
    })
  ).json();
  const sql = app.get<Database>(DATABASE).$client;
  // Test-helper users have no password account; add a fixture credential without enabling login.
  await sql`insert into auth.account (id, account_id, provider_id, user_id, password, created_at, updated_at) values (${crypto.randomUUID()}, ${person.user.id}, 'credential', ${person.user.id}, 'fixture-hash', now(), now())`;
  const cookie = await adminCookie("helpdesk");
  const approver = await adminCookie("super-admin");
  const input = {
    reason: "Lost registered authenticator",
    evidence: "Verified manager callback; case REC-456",
    identityVerified: true,
  };
  const path = `/api/auth-management/users/${person.user.id}/factor-recovery`;
  const send = (url: string, authCookie: string) =>
    request(url, {
      method: "POST",
      headers: { cookie: authCookie },
      body: JSON.stringify(input),
    });
  const created = await send(path, cookie);
  expect(created.status).toBe(201);
  const id = (await created.json()).data.id;
  await sql`update auth."user" set name = 'Changed while pending' where id = ${person.user.id}`;
  expect(
    (await send(`/api/auth-management/recoveries/${id}/approve`, approver))
      .status,
  ).toBe(409);
  const replacementRequest = await send(path, cookie);
  expect(replacementRequest.status).toBe(201);
  const replacementId = (await replacementRequest.json()).data.id;
  await sql`update identity_operations.factor_recovery set expires_at = now() - interval '1 second' where id = ${replacementId}`;
  expect(
    (
      await send(
        `/api/auth-management/recoveries/${replacementId}/approve`,
        approver,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await (
        await request("/api/auth/get-session", {
          headers: { cookie: targetCookie },
        })
      ).json()
    ).user.id,
  ).toBe(person.user.id);
});

test("offboarding atomically suspends identity and removes memberships, sessions and business grants", async () => {
  const cookie = await adminCookie("super-admin");
  const targetCookie = await adminCookie("user");
  const person = await (
    await request("/api/auth/get-session", {
      headers: { cookie: targetCookie },
    })
  ).json();
  const send = (path: string, body: unknown) =>
    request(path, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(body),
    });
  const subsidiary = await send("/api/auth-management/subsidiaries", {
    name: "Offboard scope",
    slug: `offboard-${crypto.randomUUID()}`,
  });
  const organizationId = (await subsidiary.json()).data.id;
  expect(
    (
      await send(
        `/api/auth-management/subsidiaries/${organizationId}/members`,
        { userId: person.user.id },
      )
    ).status,
  ).toBe(201);
  const grant = await send("/api/access-control/assignments", {
    userId: person.user.id,
    organizationId,
    scope: "subsidiary",
    roleId: "system-domain-administrator",
  });
  expect(grant.status).toBe(201);
  const assignmentId = (await grant.json()).data.id;
  const offboard = `/api/auth-management/users/${person.user.id}/offboard`;
  expect(
    (await send(offboard, { reason: "HR authorized departure; case OFF-123" }))
      .status,
  ).toBe(201);
  expect(
    (await send(offboard, { reason: "HR authorized departure; case OFF-123" }))
      .status,
  ).toBe(201);
  const sql = app.get<Database>(DATABASE).$client;
  const [stored] =
    await sql`select banned, role from auth."user" where id = ${person.user.id}`;
  expect(stored.banned).toBe(true);
  expect(stored.role).toBe("user");
  expect(
    await sql`select id from auth.member where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  expect(
    await sql`select id from auth.session where user_id = ${person.user.id}`,
  ).toHaveLength(0);
  const [assignment] =
    await sql`select revoked_at from access_control.access_assignment where id = ${assignmentId}`;
  expect(assignment.revoked_at).not.toBeNull();
});

test("subsidiary ownership cannot bypass group identity policy and temporary operators cannot use native admin routes", async () => {
  const cookie = await adminCookie("super-admin");
  const me = await (
    await request("/api/auth/get-session", { headers: { cookie } })
  ).json();
  const created = await request("/api/auth-management/subsidiaries", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: "Owner policy",
      slug: `owner-policy-${crypto.randomUUID()}`,
    }),
  });
  expect(created.status).toBe(201);
  const organizationId = (await created.json()).data.id;
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set role = 'user' where id = ${me.user.id}`;
  const denied = await request("/api/auth/organization/create-team", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ organizationId, name: "Unauthorized team" }),
  });
  expect(denied.status).toBe(403);
  expect((await denied.json()).code).toBe("IDENTITY_ADMIN_REQUIRED");
  expect(
    (
      await request("/api/auth/organization/list-user-teams", {
        headers: { cookie },
      })
    ).status,
  ).toBe(200);
  await sql`update auth."user" set role = 'super-admin', must_change_password = true where id = ${me.user.id}`;
  for (const path of [
    "/api/auth/admin/list-users",
    "/api/auth/organization/list-user-teams",
  ]) {
    const response = await request(path, { headers: { cookie } });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("PASSWORD_CHANGE_REQUIRED");
  }
});

test("an impersonated session cannot review, grant or change roles as its target", async () => {
  const operatorCookie = await adminCookie("super-admin");
  const send = (path: string, body: unknown, cookie = operatorCookie) =>
    request(path, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify(body),
    });
  const sessionOf = async (cookie: string) =>
    (await request("/api/auth/get-session", { headers: { cookie } })).json();
  const operator = await sessionOf(operatorCookie);
  const subsidiary = await send("/api/auth-management/subsidiaries", {
    name: "Impersonation scope",
    slug: `impersonation-${crypto.randomUUID()}`,
  });
  expect(subsidiary.status).toBe(201);
  const assignment = await send("/api/access-control/assignments", {
    organizationId: (await subsidiary.json()).data.id,
    scope: "subsidiary",
    roleId: "system-domain-administrator",
    userId: operator.user.id,
  });
  expect(assignment.status).toBe(201);
  const assignmentId = (await assignment.json()).data.id;
  const reviewer = await sessionOf(await adminCookie("access-reviewer"));
  const employee = await sessionOf(await adminCookie("user"));

  const impersonated = await send("/api/auth/admin/impersonate-user", {
    userId: reviewer.user.id,
  });
  expect(impersonated.status).toBe(200);
  const cookie = [
    ...new Map(
      impersonated.headers.getSetCookie().map((value) => {
        const pair = value.split(";", 1)[0]!;
        return [pair.slice(0, pair.indexOf("=")), pair] as const;
      }),
    ).values(),
  ].join("; ");
  const session = await sessionOf(cookie);
  expect(session.user.id).toBe(reviewer.user.id);
  expect(session.session.impersonatedBy).toBe(operator.user.id);

  const subject = (
    await (
      await request("/api/access-control/reviews", {
        headers: { cookie: operatorCookie },
      })
    ).json()
  ).data.find((row: { id: string }) => row.id === assignmentId);
  for (const [path, body] of [
    [
      `/api/access-control/reviews/assignment/${assignmentId}`,
      {
        decision: "confirmed",
        note: "Manager confirmed responsibility in case 123",
        snapshot: subject.snapshot,
      },
    ],
    [`/api/directory/access-reviews/${operator.user.id}`, {}],
    ["/api/auth/admin/set-role", { userId: employee.user.id, role: "admin" }],
  ] as const) {
    const response = await send(path, body, cookie);
    expect(response.status).toBe(403);
  }

  const sql = app.get<Database>(DATABASE).$client;
  expect(
    await sql`select 1 from access_control.access_review where subject_id = ${assignmentId}`,
  ).toHaveLength(0);
  expect(
    await sql`select 1 from directory.privileged_access_review where user_id = ${operator.user.id}`,
  ).toHaveLength(0);
  const [target] =
    await sql`select role from auth."user" where id = ${employee.user.id}`;
  expect(target.role).toBe("user");
});

const userIdOf = async (email: string): Promise<string> =>
  (
    await app.get<Database>(DATABASE).$client`
      select id from auth."user" where email = ${email}`
  )[0].id;

const sessionUserId = async (cookie: string): Promise<string> =>
  (
    await (
      await request("/api/auth/get-session", { headers: { cookie } })
    ).json()
  ).user.id;

/** The signed token a session cookie carries, sent the way the door's fallback sends it. */
const bearerOf = (cookie: string): string => {
  const pair = cookie
    .split("; ")
    .find((part) => part.startsWith("better-auth.session_token="))!;
  return `Bearer ${decodeURIComponent(pair.slice(pair.indexOf("=") + 1))}`;
};

const impersonationCookie = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0]!)
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

test("a refused password reissue sends the person nothing", async () => {
  const employee = await issueAccount("RefusedReissue123!");
  const sql = app.get<Database>(DATABASE).$client;
  const resets = async () =>
    (
      await sql`select id from notification.message
        where key = 'account.password-reset' and destination = ${`personal.${employee.email}`}`
    ).length;
  const before = await resets();
  const refused = await request("/api/auth/admin/set-user-password", {
    method: "POST",
    headers: { cookie: await adminCookie("user", false) },
    body: JSON.stringify({
      userId: await userIdOf(employee.email),
      newPassword: "Call +1-555-0100 to finish your reset",
    }),
  });
  expect(refused.status).toBe(403);
  expect(await resets()).toBe(before);
});

test("an identity admin cannot rewrite second-factor or temporary-password state", async () => {
  const employee = await issueAccount("GuardedFields123!");
  const userId = await userIdOf(employee.email);
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set two_factor_enabled = true where id = ${userId}`;
  const cookie = await adminCookie();
  const update = (data: Record<string, unknown>) =>
    request("/api/auth/admin/update-user", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ userId, data }),
    });
  for (const data of [
    { twoFactorEnabled: false },
    { mustChangePassword: false },
    { temporaryPasswordExpiresAt: null },
    { banned: true },
    { name: "Renamed", emailVerified: false },
  ]) {
    const response = await update(data);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("USER_FIELD_NOT_EDITABLE");
  }
  const [row] =
    await sql`select name, two_factor_enabled, must_change_password, banned
    from auth."user" where id = ${userId}`;
  expect(row).toEqual({
    banned: false,
    must_change_password: true,
    name: "Integration Employee",
    two_factor_enabled: true,
  });
  expect((await update({ name: "Renamed Employee" })).status).toBe(200);
});

test("an expired temporary password is refused after the second factor too", async () => {
  const employee = await enrolledEmployee("ExpiringFactor123!");
  const sql = app.get<Database>(DATABASE).$client;
  await sql`update auth."user" set must_change_password = true,
    temporary_password_expires_at = now() + interval '1 hour' where email = ${employee.email}`;
  const jar = await challenge(employee);
  const verified = await jar.post("/api/auth/two-factor/verify-totp", {
    code: authenticatorCode(employee.totpURI, Date.now() + 30_000),
  });
  expect(verified.status).toBe(200);
  await sql`update auth."user" set temporary_password_expires_at = now() - interval '1 second'
    where email = ${employee.email}`;

  const body = JSON.stringify({
    currentPassword: employee.password,
    newPassword: "ChosenTooLate123!",
  });
  for (const headers of [
    { cookie: jar.header() },
    { authorization: bearerOf(jar.header()) },
  ] as Record<string, string>[]) {
    const changed = await request("/api/auth/change-password", {
      method: "POST",
      headers,
      body,
    });
    expect(changed.status).toBe(403);
    expect((await changed.json()).code).toBe("TEMPORARY_PASSWORD_EXPIRED");
  }

  const again = await cookieJar().post("/api/auth/sign-in/email", employee);
  expect(again.status).toBe(403);
  expect((await again.json()).code).toBe("TEMPORARY_PASSWORD_EXPIRED");
  expect(
    again.headers
      .getSetCookie()
      .some((value) => /^better-auth\.session_token=[^;]/.test(value)),
  ).toBe(false);
});

test("a bearer token meets the same administration policy as the session cookie", async () => {
  const targetId = await sessionUserId(await adminCookie("super-admin"));
  // Another active super-admin, so the last-one rule is not what refuses this.
  await adminCookie("super-admin");
  const cases = [
    {
      cookie: await adminCookie("admin"),
      init: { method: "POST", body: JSON.stringify({ userId: targetId }) },
      path: "/api/auth/admin/ban-user",
      code: "PRIVILEGED_TARGET_REQUIRES_SUPER_ADMIN",
    },
    {
      cookie: await adminCookie("admin", false),
      init: {},
      path: "/api/auth/admin/list-users",
      code: "PRIVILEGED_TWO_FACTOR_REQUIRED",
    },
  ];
  for (const { cookie, init, path, code } of cases) {
    const sent: Record<string, string>[] = [
      { cookie },
      { authorization: bearerOf(cookie) },
    ];
    for (const headers of sent) {
      const response = await request(path, { ...init, headers });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe(code);
    }
  }
  const [target] = await app.get<Database>(DATABASE).$client`
    select banned from auth."user" where id = ${targetId}`;
  expect(target.banned).not.toBe(true);
});

test("an impersonated session reads but writes nothing outside the auth routes", async () => {
  const operatorCookie = await adminCookie("super-admin");
  const subsidiary = await request("/api/auth-management/subsidiaries", {
    method: "POST",
    headers: { cookie: operatorCookie },
    body: JSON.stringify({
      name: "Impersonation guard",
      slug: `impersonation-${crypto.randomUUID()}`,
    }),
  });
  const organizationId = (await subsidiary.json()).data.id;
  const targetId = await sessionUserId(await adminCookie("admin"));
  const impersonated = await request("/api/auth/admin/impersonate-user", {
    method: "POST",
    headers: { cookie: operatorCookie },
    body: JSON.stringify({ userId: targetId }),
  });
  expect(impersonated.status).toBe(200);
  const cookie = impersonationCookie(impersonated);

  expect(
    (await request("/api/directory", { headers: { cookie } })).status,
  ).toBe(200);
  const team = await request(
    `/api/auth-management/subsidiaries/${organizationId}/teams`,
    {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ name: "Made while impersonating" }),
    },
  );
  expect(team.status).toBe(403);
  expect((await team.json()).code).toBe("IMPERSONATED_SESSION");
  expect(
    await app.get<Database>(DATABASE).$client`
      select 1 from auth.team where organization_id = ${organizationId}`,
  ).toHaveLength(0);
});

test("reissuing a password ends every session the person holds", async () => {
  const employee = await issueAccount("ReissueEndsSessions123!");
  const held = sessionCookie(await signIn(employee.email, employee.password))!;
  const reissued = await request("/api/auth/admin/set-user-password", {
    method: "POST",
    headers: { cookie: await adminCookie() },
    body: JSON.stringify({
      userId: await userIdOf(employee.email),
      newPassword: "ReissuedPassword123!",
    }),
  });
  expect(reissued.status).toBe(200);
  expect(
    await (
      await request("/api/auth/get-session", { headers: { cookie: held } })
    ).json(),
  ).toBeNull();
});

test("impersonating someone at the session cap ends none of their sessions", async () => {
  const first = await adminCookie("user", false);
  const personId = await sessionUserId(first);
  const held = [
    first,
    await adminCookie("user", false, personId),
    await adminCookie("user", false, personId),
  ];
  const impersonated = await request("/api/auth/admin/impersonate-user", {
    method: "POST",
    headers: { cookie: await adminCookie("super-admin") },
    body: JSON.stringify({ userId: personId }),
  });
  expect(impersonated.status).toBe(200);
  for (const cookie of held) {
    const session = await (
      await request("/api/auth/get-session", { headers: { cookie } })
    ).json();
    expect(session?.user.id).toBe(personId);
  }
});
