import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("signed-out entry reaches usable sign-in controls", async ({
  app,
  screen,
}) => {
  await app.open("/");
  await expect(
    screen.getByRole("button", { name: "Show password", exact: true }),
  ).toBeVisible();
  await screen
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(
    screen.getByRole("button", { name: "Hide password", exact: true }),
  ).toBeVisible();
});
