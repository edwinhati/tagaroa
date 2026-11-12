import { expect, test } from "@playwright/test";
import {
  E2E_ADMIN,
  E2E_ORIGINS,
  TEST_DATABASE_URL,
} from "@repo/test-support/e2e-stack";
import { SQL } from "bun";

const core = E2E_ORIGINS.core;
const domain = `${E2E_ORIGINS.engineering}/engineering`;
const origin = E2E_ORIGINS.auth;

test(
  "engineering requires a session and current Engineering membership",
  { lock: "e2e-admin" },
  async ({ page, request, browser }) => {
    await page.goto(domain, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/localhost:13001\/\?redirect=/);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const sql = new SQL(TEST_DATABASE_URL);
    const operator = E2E_ADMIN;
    const headers = { origin };
    const [original] =
      await sql`select role from auth."user" where email = ${operator.email}`;
    let other: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let organizationId: string | undefined;
    const userIds: string[] = [];
    try {
      await sql`update auth."user" set two_factor_enabled = false, role = 'super-admin' where email = ${operator.email}`;
      expect(
        (
          await request.post(`${core}/api/auth/sign-in/email`, {
            data: operator,
            headers,
          })
        ).ok(),
      ).toBe(true);
      await sql`update auth."user" set two_factor_enabled = true where email = ${operator.email}`;
      const email = `domain-${crypto.randomUUID()}@tagaroa.test`;
      const password = "DomainFixturePassword123!";
      const created = await request.post(`${core}/api/auth/admin/create-user`, {
        data: {
          email,
          password,
          name: "Domain QA",
          data: { personalEmail: `personal.${email}` },
        },
        headers,
      });
      expect(created.ok()).toBe(true);
      const userId = (await created.json()).user.id;
      userIds.push(userId);
      await sql`update auth."user" set must_change_password = false where id = ${userId}`;
      const subsidiary = await request.post(
        `${core}/api/auth-management/subsidiaries`,
        {
          data: { name: "Domain QA", slug: `domain-${crypto.randomUUID()}` },
          headers,
        },
      );
      expect(subsidiary.status()).toBe(201);
      organizationId = (await subsidiary.json()).data.id;
      const team = await request.post(
        `${core}/api/auth-management/subsidiaries/${organizationId}/teams`,
        {
          data: { name: "Engineering" },
          headers,
        },
      );
      expect(team.status()).toBe(201);
      const teamId = (await team.json()).data.id;
      expect(
        (
          await request.put(
            `${core}/api/access-control/teams/${teamId}/domain`,
            {
              data: { domainSlug: "engineering" },
              headers,
            },
          )
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post(`${core}/api/auth/sign-in/email`, {
            data: { email, password },
            headers,
          })
        ).ok(),
      ).toBe(true);
      expect(
        (await (await page.request.get(`${core}/api/auth/get-session`)).json())
          .user.id,
      ).toBe(userId);
      await page.goto(domain, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
      await expect(
        page.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      expect(
        (
          await request.post(
            `${core}/api/auth-management/subsidiaries/${organizationId}/members`,
            { data: { userId, role: "member" }, headers },
          )
        ).ok(),
      ).toBe(true);
      const otherEmail = `other-${crypto.randomUUID()}@tagaroa.test`;
      const issuedOther = await request.post(
        `${core}/api/auth/admin/create-user`,
        {
          headers,
          data: {
            email: otherEmail,
            password,
            name: "Unassigned colleague",
            data: { personalEmail: `personal.${otherEmail}` },
          },
        },
      );
      expect(issuedOther.ok()).toBe(true);
      const otherId = (await issuedOther.json()).user.id;
      userIds.push(otherId);
      await sql`update auth."user" set must_change_password = false where id = ${otherId}`;
      expect(
        (
          await request.post(
            `${core}/api/auth-management/subsidiaries/${organizationId}/members`,
            { headers, data: { userId: otherId } },
          )
        ).ok(),
      ).toBe(true);
      other = await browser.newContext();
      expect(
        (
          await other.request.post(`${core}/api/auth/sign-in/email`, {
            headers,
            data: { email: otherEmail, password },
          })
        ).ok(),
      ).toBe(true);
      const colleague = await other.newPage();
      expect(
        (
          await request.post(`${core}/api/auth/organization/set-active`, {
            data: { organizationId },
            headers,
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await request.post(`${core}/api/auth/organization/add-team-member`, {
            data: { teamId, userId },
            headers,
          })
        ).ok(),
      ).toBe(true);
      await page.goto(domain, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Engineering", exact: true }),
      ).toBeVisible();
      await colleague.goto(domain, { waitUntil: "domcontentloaded" });
      await expect(colleague).toHaveURL(`${E2E_ORIGINS.workspace}/`);
      await expect(
        colleague.getByRole("heading", { name: "Home", exact: true }),
      ).toBeVisible();
      await expect(
        colleague.getByRole("link", { name: "Engineering", exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Engineering", exact: true }),
      ).toBeVisible();
      expect(
        (
          await (
            await colleague.request.get(`${core}/api/auth/get-session`)
          ).json()
        ).user.id,
      ).toBe(otherId);
      expect(
        (
          await request.post(
            `${core}/api/auth/organization/remove-team-member`,
            {
              data: { teamId, userId },
              headers,
            },
          )
        ).ok(),
      ).toBe(true);
      await page.reload();
      await expect(page).toHaveURL(`${E2E_ORIGINS.workspace}/`);
      await request.post(`${core}/api/auth/admin/remove-user`, {
        data: { userId },
        headers,
      });
    } finally {
      await other?.close();
      for (const id of userIds)
        await sql`delete from auth."user" where id = ${id}`;
      if (organizationId)
        await sql`delete from auth.organization where id = ${organizationId}`;
      await sql`update auth."user" set role = ${original.role}, two_factor_enabled = true where email = ${operator.email}`;
      await sql.close();
    }
  },
);
