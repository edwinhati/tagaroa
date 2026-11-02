import { beforeEach, expect, mock, test } from "bun:test";

import { cloneElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Bun module mocks persist across files; keep UI substitutes out of the other suites.
if (process.env.SHELL_APP_TEST !== "1") {
  test("app shell navigation and visibility", async () => {
    const child = Bun.spawn([process.execPath, "test", import.meta.path], {
      env: { ...process.env, SHELL_APP_TEST: "1" },
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
  let isMobile = false;
  let state = "expanded";
  const setOpen = mock();
  const setOpenMobile = mock();
  const menuActions = new Map<string, () => void>();
  const railActions = new Map<string, (() => void) | undefined>();
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const sidebar = Object.fromEntries(
    [
      "Sidebar",
      "SidebarContent",
      "SidebarFooter",
      "SidebarGroup",
      "SidebarGroupContent",
      "SidebarHeader",
      "SidebarMenu",
      "SidebarMenuItem",
      "SidebarProvider",
      "SidebarRail",
    ].map((name) => [name, wrapper]),
  );
  mock.module("@repo/ui/components/sidebar", () => ({
    ...sidebar,
    SidebarInset: ({ children, id }: { children: ReactNode; id: string }) => (
      <main id={id}>{children}</main>
    ),
    SidebarTrigger: () => <button>Toggle sidebar</button>,
    SidebarMenuButton: ({
      children,
      render,
      tooltip,
      onClick,
    }: {
      children: ReactNode;
      render?: ReactElement;
      tooltip?: string;
      onClick?: () => void;
    }) => {
      if (tooltip) railActions.set(tooltip, onClick);
      return render ? (
        cloneElement(render, {}, children)
      ) : (
        <button>{children}</button>
      );
    },
    useSidebar: () => ({ isMobile, state, setOpen, setOpenMobile }),
  }));
  mock.module("@repo/ui/blocks/theme", () => ({
    ThemeToggle: () => <button>Theme</button>,
  }));
  mock.module("@tanstack/react-router", () => ({
    Link: ({ to, children }: { to: string; children?: ReactNode }) => (
      <a href={to}>{children}</a>
    ),
    useRouterState: () => "/engineering/work",
    redirect: (options: unknown) => ({ options }),
  }));
  mock.module("@repo/ui/components/dropdown-menu", () => ({
    ...Object.fromEntries(
      [
        "DropdownMenu",
        "DropdownMenuContent",
        "DropdownMenuGroup",
        "DropdownMenuLabel",
        "DropdownMenuSeparator",
      ].map((name) => [name, wrapper]),
    ),
    DropdownMenuTrigger: ({ render }: { render: ReactElement }) => render,
    DropdownMenuItem: ({
      children,
      render,
      onClick,
    }: {
      children: ReactNode;
      render?: ReactElement;
      onClick?: () => void;
    }) => {
      if (onClick && typeof children !== "string") {
        const label = Array.isArray(children)
          ? children.find((child) => typeof child === "string")
          : undefined;
        if (label) menuActions.set(label.trim(), onClick);
      }
      return render ? (
        cloneElement(render, {}, children)
      ) : (
        <button>{children}</button>
      );
    },
  }));
  mock.module("./impersonation-notice", () => ({
    ImpersonationNotice: ({ operator }: { operator: string }) => (
      <aside>Impersonating {operator}</aside>
    ),
  }));
  const { AppShell } = await import("./app-shell");
  const Icon = () => <svg />;
  let context: import("./app-shell").AppShellNavContext;
  let mobile: import("./app-shell").AppShellNavContext;
  const props = {
    operator: "ana@tagaroa.com",
    brandHref: "https://workspace.example",
    activeGroupKey: "work",
    contextTitle: "Engineering",
    groups: [
      { key: "work", label: "Work", icon: Icon, to: "/work" },
      { key: "people", label: "People", icon: Icon, to: "/people" },
      {
        key: "finance",
        label: "Finance",
        icon: Icon,
        href: "https://finance.example",
      },
      { key: "empty", label: "Other", icon: Icon },
    ],
    renderContextNav: (ctx: import("./app-shell").AppShellNavContext) => {
      context = ctx;
      return <span>Context navigation</span>;
    },
    renderMobileNav: (ctx: import("./app-shell").AppShellNavContext) => {
      mobile = ctx;
      return <span>Mobile navigation</span>;
    },
    children: <p>Work content</p>,
  };
  beforeEach(() => {
    isMobile = false;
    state = "expanded";
    setOpen.mockClear();
    setOpenMobile.mockClear();
    menuActions.clear();
    railActions.clear();
  });

  test("desktop navigation uses links for other surfaces and a button for the current group", () => {
    const html = renderToStaticMarkup(
      <AppShell {...props} contentId="work-content" />,
    );
    expect(html).toContain('href="#work-content"');
    expect(html).toContain('id="work-content"');
    expect(html).toContain(
      '<button type="button"><svg></svg><span class="sr-only">Work</span></button>',
    );
    expect(html).toContain('href="/people"');
    expect(html).toContain('href="https://finance.example"');
    expect(html).not.toContain('href="/work"');
    expect(html).toContain("Work content");
    expect(context!).toEqual({ pathname: "/engineering/work" });
    railActions.get("Work")!();
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(railActions.get("Finance")).toBeUndefined();
  });

  test("account settings and admin links appear only when offered by the host", () => {
    const normal = renderToStaticMarkup(<AppShell {...props} />);
    expect(normal).not.toContain("Account settings");
    expect(normal).not.toContain('href="https://admin.example"');
    const onAccountSettings = mock();
    const privileged = renderToStaticMarkup(
      <AppShell
        {...props}
        adminHref="https://admin.example"
        onAccountSettings={onAccountSettings}
      />,
    );
    expect(privileged).toContain('href="https://admin.example"');
    expect(privileged).toContain("Account settings");
    menuActions.get("Account settings")!();
    expect(onAccountSettings).toHaveBeenCalledTimes(1);
    expect(setOpenMobile).not.toHaveBeenCalled();
  });

  test("mobile uses host navigation and closes the drawer on navigation or account settings", () => {
    isMobile = true;
    const onAccountSettings = mock();
    const html = renderToStaticMarkup(
      <AppShell
        {...props}
        brandMark="Engineering"
        onAccountSettings={onAccountSettings}
      />,
    );
    expect(html).toContain("Mobile navigation");
    expect(html).not.toContain("Context navigation");
    expect(html).toContain("Engineering");
    expect(mobile!.pathname).toBe("/engineering/work");
    mobile!.onNavigate!();
    expect(setOpenMobile).toHaveBeenLastCalledWith(false);
    menuActions.get("Account settings")!();
    expect(setOpenMobile).toHaveBeenCalledTimes(2);
    expect(onAccountSettings).toHaveBeenCalledTimes(1);
  });

  test("shows the impersonation notice only for an impersonated session", () => {
    expect(renderToStaticMarkup(<AppShell {...props} />)).not.toContain(
      "Impersonating",
    );
    expect(
      renderToStaticMarkup(<AppShell {...props} impersonating />),
    ).toContain("Impersonating ana@tagaroa.com");
  });

  test("the top bar exposes a trigger on mobile and collapsed desktop", () => {
    const count = () =>
      renderToStaticMarkup(<AppShell {...props} />).split("Toggle sidebar")
        .length - 1;
    expect(count()).toBe(1);
    state = "collapsed";
    expect(count()).toBe(2);
    isMobile = true;
    expect(count()).toBe(1);
  });
}
