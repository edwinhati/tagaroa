import { expect, spyOn, test } from "bun:test";

import { Logger } from "@nestjs/common";

import { OnboardingHook } from "../../src/modules/auth/onboarding.hook";
import {
  NOTIFICATION_SENDER,
  type NotificationSender,
} from "../../src/modules/notification/application/notification.facade";
import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import {
  adminCookie,
  app,
  issueAccount,
  request,
  serveCore,
  sessionCookie,
  signIn,
  userIdOf,
} from "./harness";

serveCore();

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

    send.mockResolvedValue({ id: "queued", status: "pending" });
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
