import { expect, test } from "@playwright/test";

// `*.localtest.me` resolves to 127.0.0.1 and is not a public suffix, so these
// hosts are same-site with each other the way `*.dev.tagaroa.cc` are.
const port = process.env.DEPLOYED_PORT ?? "8443";
const api = `https://dev.localtest.me:${port}`;
const door = `https://auth.dev.localtest.me:${port}`;
const app = `https://app.dev.localtest.me:${port}`;
const email = "first-admin@fixture.invalid";

test("the door's sign-in reaches app. through a cookie only the API host gets", async ({
  context,
  page,
}) => {
  await page.goto(door);
  await page.getByLabel("Email").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.BOOTSTRAP_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // The door only asks for a new password once it reads the session back.
  await expect(
    page.getByRole("heading", { name: "Choose your password" }),
  ).toBeVisible();

  const session = (await context.cookies(api)).find(
    (cookie) => cookie.name === "__Host-better-auth.session_token",
  );
  // No leading dot: host-only. `context.cookies(url)` can't show that, it
  // matches host-only cookies as if they had a Domain.
  expect(session).toMatchObject({
    domain: "dev.localtest.me",
    httpOnly: true,
    path: "/",
    secure: true,
  });
  // Hashed-asset 404s are real pages on each host that never redirect, unlike
  // the apps (a route stub would count as a public page in Chromium's local
  // network rules and lose the loopback fetch).
  for (const other of [door, app]) {
    const headers = await (
      await page.goto(`${other}/assets/probe`)
    )
      ?.request()
      .allHeaders();
    expect(headers?.cookie ?? "").not.toContain("better-auth");
  }

  const user = await page.evaluate(async (url) => {
    const response = await fetch(`${url}/api/auth/get-session`, {
      credentials: "include",
    });
    return (await response.json())?.user?.email;
  }, api);
  expect(user).toBe(email);
});
