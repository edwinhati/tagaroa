import { Logo } from "@repo/ui/blocks/logo";
import { ThemeToggle } from "@repo/ui/blocks/theme";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Separator } from "@repo/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/components/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  EllipsisVerticalIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
} from "lucide-react";
import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { authClient } from "./auth-client";
import { ImpersonationNotice } from "./impersonation-notice";
import { signInUrl } from "./session";

export type AppShellIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

/**
 * Icon-rail entry. Use `to` for in-app routes, `href` for microfrontend /
 * cross-origin targets (plain anchors — a router Link would miss the route).
 */
export type AppShellGroup = {
  key: string;
  label: string;
  icon: AppShellIcon;
  to?: string;
  href?: string;
};

export type AppShellNavContext = {
  pathname: string;
  onNavigate?: () => void;
};

const TrailHostContext = createContext<{
  host: HTMLElement | null;
  setHost: (host: HTMLElement | null) => void;
} | null>(null);

function TrailHostProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ host, setHost }), [host]);
  return (
    <TrailHostContext.Provider value={value}>
      {children}
    </TrailHostContext.Provider>
  );
}

function useTrailHost() {
  const ctx = useContext(TrailHostContext);
  if (!ctx) {
    throw new Error("App trail must render inside AppShell");
  }
  return ctx;
}

/** One stroke weight for every nav glyph. Active is the row, not a fill. */
export function NavGlyph({ icon: Icon }: { icon: AppShellIcon }) {
  return <Icon aria-hidden="true" strokeWidth={1.5} />;
}

/**
 * Nested collapsible rails + Blast-style top bar. Nav content is supplied by
 * the app; chrome (layout, trigger placement, trail host, operator) is shared.
 */
export function AppShell({
  operator,
  brandHref,
  brandMark,
  contentId = "app-content",
  groups,
  activeGroupKey,
  contextTitle,
  renderContextNav,
  renderMobileNav,
  adminHref,
  onAccountSettings,
  impersonating = false,
  children,
}: {
  operator: string;
  /** Where the mark leads — usually the workspace origin. */
  brandHref: string;
  /** Short product mark on the mobile drawer (e.g. "Admin"). */
  brandMark?: string;
  contentId?: string;
  groups: readonly AppShellGroup[];
  activeGroupKey: string;
  contextTitle: string;
  renderContextNav: (ctx: AppShellNavContext) => ReactNode;
  renderMobileNav: (ctx: AppShellNavContext) => ReactNode;
  /** Offer Admin in the account menu when the operator may open it. */
  adminHref?: string;
  /** Opens the account settings surface (dialog owned by the host app). */
  onAccountSettings?: () => void;
  impersonating?: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider
      className="flex-col"
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "3rem",
          "--sidebar-width-mobile": "16rem",
        } as React.CSSProperties
      }
    >
      <TrailHostProvider>
        <a
          className="left-3 top-3 -translate-y-20 px-3 py-2 text-sm font-medium focus:translate-y-0 fixed z-50 rounded-md border border-border bg-background shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`#${contentId}`}
        >
          Skip to content
        </a>
        <div className="min-h-0 flex w-full flex-1">
          <AppNavigation
            activeGroupKey={activeGroupKey}
            adminHref={adminHref}
            brandHref={brandHref}
            onAccountSettings={onAccountSettings}
            brandMark={brandMark}
            contextTitle={contextTitle}
            groups={groups}
            operator={operator}
            renderContextNav={renderContextNav}
            renderMobileNav={renderMobileNav}
          />
          <SidebarInset
            className="min-w-0 min-h-svh"
            id={contentId}
            tabIndex={-1}
          >
            <TopBar />
            <div className="min-h-0 flex flex-1">{children}</div>
          </SidebarInset>
        </div>
        {impersonating ? <ImpersonationNotice operator={operator} /> : null}
      </TrailHostProvider>
    </SidebarProvider>
  );
}

function groupTarget(group: AppShellGroup, current: boolean) {
  if (current) return <button type="button" />;
  if (group.href) return <a href={group.href} />;
  if (group.to) return <Link to={group.to} />;
  return <button type="button" />;
}

function AppNavigation({
  operator,
  brandHref,
  brandMark,
  groups,
  activeGroupKey,
  contextTitle,
  renderContextNav,
  renderMobileNav,
  adminHref,
  onAccountSettings,
}: {
  operator: string;
  brandHref: string;
  brandMark?: string;
  groups: readonly AppShellGroup[];
  activeGroupKey: string;
  contextTitle: string;
  renderContextNav: (ctx: AppShellNavContext) => ReactNode;
  renderMobileNav: (ctx: AppShellNavContext) => ReactNode;
  adminHref?: string;
  onAccountSettings?: () => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const openContext = () => {
    setOpen(true);
  };

  if (isMobile) {
    return (
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="h-11 px-3 justify-center border-b border-sidebar-border">
          <a
            className="min-w-0 gap-2.5 px-1 flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            href={brandHref}
          >
            <Logo size={17} />
            <span className="text-sm font-medium truncate">Tagaroa</span>
            {brandMark ? (
              <span className="text-xs text-muted-foreground">{brandMark}</span>
            ) : null}
          </a>
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label="Application navigation" className="py-2">
            {renderMobileNav({
              pathname,
              onNavigate: () => setOpenMobile(false),
            })}
          </nav>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-sidebar-border">
          <OperatorFooter
            adminHref={adminHref}
            onAccountSettings={onAccountSettings}
            operator={operator}
          />
          <div className="px-1 pt-1 flex justify-end">
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      collapsible="icon"
    >
      <Sidebar
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r border-sidebar-border"
        collapsible="none"
        data-rail
      >
        <SidebarHeader className="h-10 p-1.5 items-center justify-center border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="justify-center"
                render={<a aria-label="Tagaroa workspace" href={brandHref} />}
                tooltip="Tagaroa workspace"
              >
                <Logo size={17} />
                <span className="sr-only">Tagaroa</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label="Application groups">
            <SidebarGroup className="px-1.5 py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {groups.map((group) => {
                    const current = group.key === activeGroupKey;
                    return (
                      <SidebarMenuItem key={group.key}>
                        <SidebarMenuButton
                          className="justify-center"
                          isActive={current}
                          onClick={group.href ? undefined : openContext}
                          render={groupTarget(group, current)}
                          tooltip={group.label}
                        >
                          <NavGlyph icon={group.icon} />
                          <span className="sr-only">{group.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>

        <SidebarFooter className="p-1.5 items-center">
          <ThemeToggle />
        </SidebarFooter>
      </Sidebar>

      <Sidebar className="min-w-0 flex flex-1" collapsible="none">
        <SidebarHeader className="h-10 gap-2 px-3 flex-row items-center justify-between border-b border-sidebar-border">
          <span className="min-w-0 font-medium truncate text-[0.8125rem]">
            {contextTitle}
          </span>
          <SidebarTrigger className="-mr-1" />
        </SidebarHeader>

        <SidebarContent>
          <nav aria-label={`${contextTitle} navigation`} className="py-1.5">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                {renderContextNav({ pathname })}
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-sidebar-border">
          <OperatorFooter
            adminHref={adminHref}
            onAccountSettings={onAccountSettings}
            operator={operator}
          />
        </SidebarFooter>
      </Sidebar>

      <SidebarRail />
    </Sidebar>
  );
}

function TopBar() {
  const { isMobile, state } = useSidebar();
  const { setHost } = useTrailHost();
  // Trigger lives in the sidebar header when the context rail is open.
  // Keep it in the top bar for mobile offcanvas and desktop icon-collapsed.
  const showTrigger = isMobile || state === "collapsed";

  return (
    <header className="h-10 min-h-10 gap-2 px-2 flex shrink-0 items-center border-b border-border">
      {showTrigger ? (
        <>
          <SidebarTrigger />
          <span className="h-4 flex items-center">
            <Separator
              orientation="vertical"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
              }}
            />
          </span>
        </>
      ) : null}
      <div className="min-w-0 flex-1" ref={setHost} />
    </header>
  );
}

function OperatorFooter({
  operator,
  adminHref,
  onAccountSettings,
}: {
  operator: string;
  adminHref?: string;
  onAccountSettings?: () => void;
}) {
  const initial = operator.trim().charAt(0).toUpperCase();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                aria-label={`Account menu for ${initial} ${operator}`}
                className="h-9"
              >
                <Avatar size="sm">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>{" "}
                <span
                  className="min-w-0 text-xs flex-1 truncate"
                  title={operator}
                >
                  {operator}
                </span>
                <EllipsisVerticalIcon
                  aria-hidden="true"
                  className="ml-auto"
                  strokeWidth={1.5}
                />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            align="end"
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            sideOffset={6}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="gap-0.5 p-1 font-normal flex flex-col">
                <p className="px-1 pt-0.5 pb-0.5 font-medium text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                  Account
                </p>
                <div className="min-w-0 gap-2.5 px-1 py-1.5 flex items-center">
                  <Avatar size="sm">
                    <AvatarFallback>{initial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p
                      className="font-medium truncate text-[13px] text-foreground"
                      title={operator}
                    >
                      {operator}
                    </p>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onAccountSettings ? (
                <DropdownMenuItem
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    onAccountSettings();
                  }}
                >
                  <SettingsIcon aria-hidden="true" strokeWidth={1.5} />
                  Account settings
                </DropdownMenuItem>
              ) : null}
              {adminHref ? (
                <DropdownMenuItem render={<a href={adminHref} />}>
                  <ShieldIcon aria-hidden="true" strokeWidth={1.5} />
                  Admin
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={signOut}>
                <LogOutIcon aria-hidden="true" strokeWidth={1.5} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function signOut() {
  void authClient
    .signOut()
    .finally(() => window.location.assign(signInUrl(window.location.origin)));
}

export function AppTrail({
  items,
}: {
  items: Array<
    | { label: string }
    | {
        label: string;
        to: string;
        params?: Record<string, string>;
        search?: Record<string, unknown>;
      }
  >;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${item.label}:${index}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {"to" in item ? (
                <BreadcrumbLink
                  render={
                    <Link
                      params={item.params}
                      search={item.search}
                      to={item.to}
                    />
                  }
                >
                  {item.label}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="font-medium">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Page({
  title,
  description,
  actions,
  breadcrumb,
  footer,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Lifted into the top bar — pages still pass the trail here. */
  breadcrumb?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { host } = useTrailHost();

  return (
    <div className="min-h-0 min-w-0 mx-auto flex w-full max-w-[88rem] flex-1 flex-col">
      {host && breadcrumb ? createPortal(breadcrumb, host) : null}
      <div className="gap-2 px-4 pb-4 pt-4 sm:px-6 lg:px-8 flex flex-col">
        <div className="gap-2 flex flex-wrap items-center justify-between">
          <div className="min-w-0 max-w-[40rem]">
            <h1 className="font-medium text-base leading-none tracking-[-0.02em] text-balance">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 leading-relaxed max-w-[36rem] text-[12px] text-pretty text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="gap-1.5 flex shrink-0 flex-wrap items-center">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 px-4 pb-8 sm:px-6 lg:px-8 flex-1">{children}</div>
      {footer ? (
        <div className="px-4 pb-4 sm:px-6 lg:px-8 text-[11px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
