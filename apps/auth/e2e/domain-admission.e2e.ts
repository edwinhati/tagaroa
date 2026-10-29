import { expect, test } from "@playwright/test";
import { SQL } from "bun";

const core = "http://localhost:18080";
const domain = "http://localhost:13010/engineering";
const origin = "http://localhost:13001";

test(
  "engineering requires a session and current Engineering membership",
  { lock: "e2e-admin" },
  async ({ page, request }) => {
    await page.goto(domain, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/localhost:13001\/\?redirect=/);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const sql = new SQL(
      process.env.TEST_DATABASE_URL ??
        "postgresql://tagaroa:tagaroa@127.0.0.1:5432/tagaroa_test",
    );
    const operator = {
      email: "e2e-admin@tagaroa.test",
      password: "e2e-admin-password-12",
    };
    const headers = { origin };
    const [original] =
      await sql`select role from auth."user" where email = ${operator.email}`;
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
      await sql`update auth."user" set must_change_password = false where id = ${userId}`;
      const subsidiary = await request.post(
        `${core}/api/auth-management/subsidiaries`,
        {
          data: { name: "Domain QA", slug: `domain-${crypto.randomUUID()}` },
          headers,
        },
      );
      expect(subsidiary.status()).toBe(201);
      const organizationId = (await subsidiary.json()).data.id;
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
      await expect(page).toHaveURL("http://localhost:13002/");
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
      await expect(page).toHaveURL("http://localhost:13002/");
      await request.post(`${core}/api/auth/admin/remove-user`, {
        data: { userId },
        headers,
      });
    } finally {
      await sql`update auth."user" set role = ${original.role}, two_factor_enabled = true where email = ${operator.email}`;
      await sql.close();
    }
  },
);
