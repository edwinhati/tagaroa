import { expect, test } from "bun:test";

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
  signIn,
} from "./harness";

serveCore();

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
