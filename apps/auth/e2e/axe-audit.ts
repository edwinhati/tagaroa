import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "320px", width: 320, height: 640 },
];

/** Development overlays can cover controls; they are absent in production. */
export async function hideDevOverlays(context: BrowserContext) {
  await context.addInitScript(() => {
    const install = () => {
      const style = document.createElement("style");
      style.textContent =
        "#impeccable-live-global-bar, #internal-devtools, button[aria-label='Open TanStack Devtools'] { display: none !important; }";
      document.head.append(style);
    };
    if (document.head) install();
    else document.addEventListener("DOMContentLoaded", install, { once: true });
  });
}

/**
 * Runs axe (WCAG 2.2 AA) on every URL in light and dark, at desktop and 320px.
 * Serious and critical violations fail the test; the rest are attached to the
 * report as `axe-minor.json`.
 */
export async function auditRoutes(page: Page, urls: string[]) {
  const blocking: unknown[] = [];
  const minor: unknown[] = [];
  for (const url of urls) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize(viewports[0]!);
      await page.goto(url);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expect(page.locator("main h1").first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        // Entry fades would otherwise be measured mid-transition.
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.effect?.getComputedTiming().iterations !== Infinity,
              )
              .map((animation) => animation.finished.catch(() => {})),
          ),
        );
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .exclude("#impeccable-live-global-bar")
          .exclude("#internal-devtools")
          .exclude("button[aria-label='Open TanStack Devtools']")
          .analyze();
        for (const { id, impact, help, nodes } of violations) {
          const found = {
            page: `${url} ${colorScheme} ${viewport.name}`,
            id,
            impact,
            help,
            targets: nodes.map((node) => node.target.join(" ")),
          };
          if (impact === "serious" || impact === "critical")
            blocking.push(found);
          else minor.push(found);
        }
      }
    }
  }
  await test.info().attach("axe-minor.json", {
    body: JSON.stringify(minor, null, 2),
    contentType: "application/json",
  });
  expect(blocking).toEqual([]);
}
