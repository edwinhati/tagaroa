import { expect, test } from "@playwright/test";
import { hideDevOverlays } from "@repo/test-support/axe-audit";
import {
  E2E_ORIGINS,
  e2eOperator,
  TEST_DATABASE_URL,
} from "@repo/test-support/e2e-stack";
import { signInOperator } from "@repo/test-support/sign-in";
import { SQL } from "bun";

const operator = e2eOperator();

const adminOrigin = E2E_ORIGINS.admin;
const coreOrigin = E2E_ORIGINS.core;
const databaseUrl = TEST_DATABASE_URL;

const browserErrors = new WeakMap<object, string[]>();

/**
 * Chrome's notice that a resize observation was deferred to the next frame.
 * Nothing is lost, and our own observer already defers its layout; the ones
 * that still trip it live inside Monaco and the dialog. Only this exact text is
 * excused — any other error still fails the test.
 */
const RESIZE_OBSERVER_NOTICE =
  "ResizeObserver loop completed with undelivered notifications.";

test.afterEach(async ({ page }, info) => {
  const errors = (browserErrors.get(info) ?? []).filter(
    (message) => message !== RESIZE_OBSERVER_NOTICE,
  );
  await info.attach("browser-errors", {
    body: JSON.stringify({ url: page.url(), errors }),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

test.beforeEach(async ({ page, context }, info) => {
  const errors: string[] = [];
  browserErrors.set(info, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await context.exposeFunction("qaCaptureWindowError", (message: string) => {
    errors.push(message);
  });
  await context.addInitScript(() => {
    window.addEventListener("error", (event) => {
      void (
        window as Window & {
          qaCaptureWindowError?: (message: string) => Promise<void>;
        }
      ).qaCaptureWindowError?.(event.message);
    });
  });
  await hideDevOverlays(context);
  await signInOperator(page, operator, adminOrigin);
});

/**
 * The editor is the only place the shell is seen before a message is sent, so
 * the thing worth asserting is that the preview is the real render — the same
 * `renderEmail` the carrier calls — and not a second implementation of it.
 */
test("remaining SMS and WhatsApp forms persist channel-specific wording", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const keys: string[] = [];
  try {
    for (const [channel, label, body] of [
      ["sms", "SMS", "QA text message."],
      ["whatsapp", "WhatsApp", "qa_approved_template"],
    ] as const) {
      const key = `qa.channel.${crypto.randomUUID().replaceAll("-", "")}`;
      keys.push(key);
      await page.goto("/notifications/templates");
      await page.getByRole("button", { name: "Create template" }).click();
      const dialog = page.getByRole("dialog", { name: "Create template" });
      await dialog.getByLabel("Template key").fill(key);
      await dialog.getByRole("button", { name: label, exact: true }).click();
      await expect(dialog.getByLabel("Subject", { exact: true })).toHaveCount(
        0,
      );
      if (channel === "sms") {
        await expect(dialog.locator(".monaco-editor")).toBeVisible({
          timeout: 20_000,
        });
        await dialog
          .getByRole("textbox", { name: "Message", exact: true })
          .focus();
        await page.keyboard.type(body);
        await expect(
          dialog.getByText("16/160 · 1 segment", { exact: true }),
        ).toBeVisible();
      } else {
        await dialog
          .getByLabel("Approved template name")
          .fill("Invalid template name");
        const invalid = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/notifications/templates") &&
            response.request().method() === "POST",
        );
        await dialog
          .getByRole("button", { name: "Save draft", exact: true })
          .click();
        expect((await invalid).status()).toBe(400);
        await expect(dialog.getByLabel("Approved template name")).toHaveValue(
          "Invalid template name",
        );
        await dialog.getByLabel("Approved template name").fill(body);
      }
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/notifications/templates") &&
          response.request().method() === "POST",
      );
      await dialog
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      expect((await saved).status()).toBe(201);
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await page.getByRole("button", { name: new RegExp(key) }).click();
      await expect(page.locator(".template-body")).toHaveText(body);
      const sql = new SQL(databaseUrl);
      try {
        const [stored] =
          await sql`select channel, subject, body from notification.template where key = ${key}`;
        expect(stored).toMatchObject({ channel, subject: null, body });
      } finally {
        await sql.close();
      }
    }
  } finally {
    const sql = new SQL(databaseUrl);
    try {
      for (const key of keys)
        await sql`delete from notification.template where key = ${key}`;
    } finally {
      await sql.close();
    }
  }
});

test("remaining concurrent draft editors cannot silently overwrite newer wording", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90_000);
  const key = `qa.concurrent.${crypto.randomUUID().replaceAll("-", "")}`;
  const created = await page.request.post(
    `${coreOrigin}/api/notifications/templates`,
    {
      headers: { origin: adminOrigin },
      data: {
        key,
        channel: "sms",
        locale: "en",
        subject: null,
        body: "Original wording",
        variables: [],
        secrets: [],
      },
    },
  );
  expect(created.status()).toBe(201);
  const other = await context.newPage();
  try {
    for (const [tab, wording] of [
      [page, "First editor wording"],
      [other, "Second editor wording"],
    ] as const) {
      await tab.goto("/notifications/templates");
      await tab.getByRole("button", { name: new RegExp(key) }).click();
      await tab
        .getByRole("button", { name: `Actions for ${key} on sms`, exact: true })
        .click();
      await tab
        .getByRole("menuitem", { name: "Edit draft", exact: true })
        .click();
      await expect(tab.locator(".monaco-editor")).toBeVisible({
        timeout: 20_000,
      });
      await tab.getByRole("textbox", { name: "Message", exact: true }).focus();
      await tab.keyboard.press(
        browserName === "webkit" ? "Meta+A" : "Control+A",
      );
      await tab.keyboard.type(wording);
      await expect(tab.locator(".monaco-editor .view-lines")).toHaveText(
        wording,
      );
    }
    await page.bringToFront();
    const first = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes("/api/notifications/templates/"),
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    expect((await first).status()).toBe(204);
    await other.bringToFront();
    const stale = other.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().includes("/api/notifications/templates/"),
    );
    await other
      .getByRole("button", { name: "Save draft", exact: true })
      .click();
    expect((await stale).status()).toBe(409);
    await expect(
      other.getByRole("dialog", { name: "Edit draft" }),
    ).toBeVisible();
    await expect(other.locator(".monaco-editor .view-lines")).toContainText(
      "Second editor wording",
    );
    const sql = new SQL(databaseUrl);
    try {
      const [stored] =
        await sql`select body from notification.template where key = ${key}`;
      expect(stored.body).toBe("First editor wording");
    } finally {
      await sql.close();
    }
  } finally {
    await other.close();
    const sql = new SQL(databaseUrl);
    try {
      await sql`delete from notification.template where key = ${key}`;
    } finally {
      await sql.close();
    }
  }
});

test("writing an email template previews it through the sending shell", async ({
  page,
}) => {
  // Wide enough for the two-column split, so the test always exercises the
  // layout the editor is designed around rather than the stacked fallback.
  await page.setViewportSize({ height: 1000, width: 1720 });
  await page.goto("/notifications/templates");
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();

  await page.getByRole("button", { name: "Create template" }).click();
  await expect(
    page.getByRole("heading", { name: "Create template" }),
  ).toBeVisible();

  // Monaco replaces the textarea once it has loaded in the browser.
  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 20_000 });
  const editor = page.getByRole("textbox", { name: "Message", exact: true });

  await editor.focus();
  await page.keyboard.type("{{name}},\n\nWelcome aboard.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("textbox", { name: "Subject" }).fill("Your account");

  const preview = page.frameLocator('iframe[title="Email preview"]');
  await expect(preview.getByText("Ada Lovelace,")).toBeVisible();
  await expect(preview.getByText("Welcome aboard.")).toBeVisible();
  await expect(
    preview.getByText(
      "Contact your administrator through your usual trusted channel.",
    ),
  ).toBeVisible();
});

test("message edits survive Monaco loading", async ({ page }) => {
  let releaseMonaco!: () => void;
  const monacoReady = new Promise<void>((resolve) => {
    releaseMonaco = resolve;
  });
  await page.route(/monaco-editor.*editor.*api/, async (route) => {
    await monacoReady;
    await route.continue();
  });

  await page.goto("/notifications/templates");
  await page.getByRole("button", { name: "Create template" }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Written before the editor loaded.");
  releaseMonaco();

  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(
    "Written before the editor loaded.",
  );
  await expect(
    page
      .frameLocator('iframe[title="Email preview"]')
      .getByText("Written before the editor loaded."),
  ).toBeVisible();
  for (const width of [1100, 768, 384, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".monaco-editor .view-lines")).toContainText(
      "Written before the editor loaded.",
    );
    await expect
      .poll(() =>
        page
          .locator(".monaco-editor")
          .evaluate((element) =>
            Math.abs(
              element.clientWidth - (element.parentElement?.clientWidth ?? 0),
            ),
          ),
      )
      .toBeLessThanOrEqual(1);
  }
});

test("a draft survives a failed save, persists after reload, publishes and discards its next version", async ({
  page,
}) => {
  const key = `qa.ui.${crypto.randomUUID().replaceAll("-", "")}`;
  await page.goto("/notifications/templates");
  await page.getByRole("button", { name: "Create template" }).click();
  await page.getByLabel("Template key").fill(key);
  await page
    .getByRole("textbox", { name: "Subject" })
    .fill("QA persisted subject");
  await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("textbox", { name: "Message", exact: true }).focus();
  await page.keyboard.type("QA persisted wording.");
  await page.route("**/api/notifications/templates", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Template key")).toHaveValue(key);
  await page.unroute("**/api/notifications/templates");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/notifications/templates") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await saved).status()).toBe(201);
  await expect(
    page.getByRole("dialog", { name: "Create template" }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: new RegExp(key) }).click();
  await expect(page.locator(".template-body")).toHaveText(
    "QA persisted wording.",
  );
  const actions = page.getByRole("button", {
    name: `Actions for ${key} on email`,
    exact: true,
  });
  await actions.click();
  await page
    .getByRole("menuitem", { name: "Publish template", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Publish template", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await actions.click();
  await page.getByRole("menuitem", { name: "Draft a new version" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`${key}.*v2`) }),
  ).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`${key}.*v2`) }).click();
  await actions.click();
  await page
    .getByRole("menuitem", { name: "Discard draft", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: new RegExp(`${key}.*v2`) }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: new RegExp(`${key}.*v1`) }),
  ).toBeVisible();
});
