import { expect, test } from "@playwright/test";

const coreServiceOrigin = "http://localhost:8080";

// Seeded by `servers/core/test/e2e-admin.ts` before the core service starts.
const admin = {
  email: "e2e-admin@tagaroa.test",
  password: "e2e-admin-password-12",
};

test("an issued operator replaces the temporary password and gets handed on", async ({
  page,
  request,
}) => {
  const email = `e2e-${crypto.randomUUID()}@tagaroa.test`;
  const temporaryPassword = "temporary-password-12";
  const chosenPassword = "chosen-password-12";
  const headers = { origin: "http://localhost:3001" };

  const signedIn = await request.post(
    `${coreServiceOrigin}/api/auth/sign-in/email`,
    { data: admin, headers },
  );
  expect(signedIn.ok()).toBe(true);

  const created = await request.post(
    `${coreServiceOrigin}/api/auth/admin/create-user`,
    {
      data: {
        email,
        name: "Browser Operator",
        password: temporaryPassword,
        role: "user",
      },
      headers,
    },
  );
  expect(created.ok()).toBe(true);

  await page.goto("/?redirect=/locked-out");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(temporaryPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  // The password an admin issued is replaced before the workspace is reachable,
  // and this page saw it typed, so it does not ask for it again.
  await expect(
    page.getByRole("heading", { name: "Choose your password" }),
  ).toBeVisible();
  await page.getByLabel("New password").fill(chosenPassword);
  await page.getByLabel("Confirm password").fill(chosenPassword);
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/locked-out$/);
  await expect(
    page.getByRole("heading", { name: "Locked out?" }),
  ).toBeVisible();
});
