import { expect, test } from "bun:test";

import {
  DATABASE,
  type Database,
} from "../../src/platform/database/database.module";
import {
  adminCookie,
  app,
  bearerOf,
  impersonationCookie,
  issueAccount,
  request,
  serveCore,
  sessionCookie,
  sessionUserId,
  signIn,
} from "./harness";

serveCore();

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
    expect((await response.json()).code).toBe("MUST_CHANGE_PASSWORD");
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
