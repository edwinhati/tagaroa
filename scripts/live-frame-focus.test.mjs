import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "apps/admin/package.json"));
const { chromium } = require("@playwright/test");
const domScript = readFileSync(
  join(root, ".agents/skills/impeccable/scripts/live-browser-dom.js"),
  "utf8",
);
const liveBrowser = readFileSync(
  join(root, ".agents/skills/impeccable/scripts/live-browser.js"),
  "utf8",
);

test("steer focus recover leaves an embedded frame alone", () => {
  assert.match(liveBrowser, /if \(focusBelongsToEmbeddedFrame\(\)\) return;/);
});

test("clicking an embedded terminal keeps the keystrokes there", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(
      `<input id="steer" /><iframe srcdoc="<textarea id=&quot;tty&quot;></textarea>"></iframe>`,
    );
    await page.addScriptTag({ content: domScript });
    await page.evaluate(() => {
      const { focusBelongsToEmbeddedFrame } =
        window.__IMPECCABLE_LIVE_DOM__.createLiveBrowserDomHelpers({
          prefix: "impeccable",
        });
      const input = document.getElementById("steer");
      input.addEventListener("blur", () => {
        setTimeout(() => {
          if (focusBelongsToEmbeddedFrame()) return;
          window.focus();
          input.focus();
        }, 30);
      });
    });
    await page.locator("#steer").focus();
    const tty = page.frameLocator("iframe").locator("#tty");
    await tty.click();
    await page.waitForTimeout(80);
    await page.keyboard.type("hi");
    assert.equal(await tty.inputValue(), "hi");
    assert.equal(await page.locator("#steer").inputValue(), "");
  } finally {
    await browser.close();
  }
});
