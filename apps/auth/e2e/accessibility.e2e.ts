import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("sign-in and locked-out guidance remain accessible in both themes, on tablet and at zoom-equivalent width", async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000);
  const moduleErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message.includes("Importing a module script failed."))
      moduleErrors.push(error.message);
  });
  await page.addInitScript(() => {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const style = document.createElement("style");
        style.textContent =
          "#impeccable-live-global-bar, #internal-devtools, button[aria-label='Open TanStack Devtools'] { display: none !important; }";
        document.head.append(style);
      },
      { once: true },
    );
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hide password", exact: true }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) => localStorage.setItem("tagaroa-theme", theme),
      theme,
    );
    for (const path of [
      "/",
      "/locked-out?reason=expired",
      "/locked-out?reason=suspended",
      "/locked-out?reason=invalid",
    ]) {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await page.evaluate(async () => {
        const animations =
          document.querySelector("main")?.getAnimations({ subtree: true }) ??
          [];
        await Promise.all(
          animations
            .filter(
              (animation) =>
                animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        );
      });
      const result = await new AxeBuilder({ page })
        .include("header, main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
        `${theme} ${path}`,
      ).toEqual([]);
      await page.setViewportSize({ width: 384, height: 512 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme} ${path}`,
      ).toBe(true);
    }
  }
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await page.evaluate(async () => {
    const animations =
      document.querySelector("main")?.getAnimations({ subtree: true }) ?? [];
    await Promise.all(
      animations
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const ready = await new AxeBuilder({ page })
    .include("header, main")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(ready.violations).toEqual([]);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  // macOS WebKit uses Option-Tab to include links in keyboard navigation.
  const nextControl = browserName === "webkit" ? "Alt+Tab" : "Tab";
  await page.getByLabel("Email", { exact: true }).focus();
  await page.keyboard.press(nextControl);
  await expect(
    page.getByRole("link", { name: "Forgot password?" }),
  ).toBeFocused();
  await page.keyboard.press(nextControl);
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press(nextControl);
  await expect(
    page.getByRole("button", { name: "Show password", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.keyboard.press(nextControl);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  expect(moduleErrors).toEqual([]);
});
