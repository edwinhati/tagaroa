import { beforeEach, expect, mock, test } from "bun:test";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Hook and portal substitutes must not leak into other React test files.
if (process.env.SHELL_NOTICE_TEST !== "1") {
  test("impersonation notice rendering and return flow", async () => {
    const child = Bun.spawn([process.execPath, "test", import.meta.path], {
      env: { ...process.env, SHELL_NOTICE_TEST: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, stdout + stderr).toBe(0);
  });
} else {
  const values: unknown[] = [];
  let cursor = 0;
  let click: () => void;
  let portalTarget: unknown;
  const stopImpersonating =
    mock<() => Promise<{ error?: { message?: string } | null }>>();
  const assign = mock();
  mock.module("react", () => ({
    ...React,
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [
        values[index],
        (value: unknown) => {
          values[index] = value;
        },
      ];
    },
  }));
  mock.module("react-dom", () => ({
    createPortal: (node: React.ReactNode, target: unknown) => {
      portalTarget = target;
      return node;
    },
  }));
  mock.module("@repo/ui/components/badge", () => ({
    Badge: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  }));
  mock.module("@repo/ui/components/button", () => ({
    Button: ({
      children,
      onClick,
      disabled,
      "aria-label": label,
    }: {
      children: React.ReactNode;
      onClick: () => void;
      disabled: boolean;
      "aria-label": string;
    }) => {
      click = onClick;
      return (
        <button disabled={disabled} aria-label={label}>
          {children}
        </button>
      );
    },
  }));
  mock.module("./auth-client", () => ({
    authClient: { admin: { stopImpersonating } },
  }));
  const { WORKSPACE_URL } = await import("./urls");
  const { ImpersonationNotice } = await import("./impersonation-notice");
  const render = () => {
    cursor = 0;
    return renderToStaticMarkup(
      ImpersonationNotice({ operator: "ana@tagaroa.com" }),
    );
  };
  beforeEach(() => {
    values.length = 0;
    cursor = 0;
    stopImpersonating.mockReset();
    assign.mockClear();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { body: {} },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { assign } },
    });
  });

  test("renders nothing without a browser document", () => {
    Reflect.deleteProperty(globalThis, "document");
    expect(render()).toBe("");
  });

  test("announces the impersonated operator in a persistent body portal", () => {
    const html = render();
    expect(portalTarget).toBe(document.body);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Impersonating");
    expect(html).toContain("ana@tagaroa.com");
    expect(html).toContain("Stop impersonating and return to your account");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain('role="alert"');
  });

  test("disables return while pending and redirects only after success", async () => {
    const pending = Promise.withResolvers<{ error: null }>();
    stopImpersonating.mockReturnValue(pending.promise);
    render();
    click();
    expect(stopImpersonating).toHaveBeenCalledTimes(1);
    const html = render();
    expect(html).toContain("disabled");
    expect(html).toContain("Returning to your account");
    expect(assign).not.toHaveBeenCalled();
    pending.resolve({ error: null });
    await pending.promise;
    expect(assign).toHaveBeenCalledWith(WORKSPACE_URL);
  });

  test("shows server errors or the fallback, enables retry, and clears stale errors", async () => {
    for (const message of ["Permission denied.", ""]) {
      const failed = Promise.resolve({ error: { message } });
      stopImpersonating.mockReturnValue(failed);
      render();
      click();
      await failed;
      const html = render();
      expect(html).toContain('role="alert"');
      expect(html).toContain(message || "Could not stop impersonating.");
      expect(html).not.toContain("disabled");
      expect(assign).not.toHaveBeenCalled();
      const retry = Promise.withResolvers<{ error: null }>();
      stopImpersonating.mockReturnValue(retry.promise);
      click();
      expect(render()).not.toContain('role="alert"');
      expect(render()).toContain("disabled");
      retry.resolve({ error: null });
      await retry.promise;
      expect(assign).toHaveBeenCalledWith(WORKSPACE_URL);
      assign.mockClear();
    }
  });
}
