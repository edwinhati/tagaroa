import { NavGlyph, type AppShellGroup } from "@repo/shell/app-shell";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@repo/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BellIcon,
  BellOffIcon,
  Building2Icon,
  ClipboardCheckIcon,
  HistoryIcon,
  IdCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  LogsIcon,
  ShieldAlertIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { directoryQueryOptions } from "../lib/admin";

type NavIcon = ComponentType<{
  className?: string;
  strokeWidth?: number;
}>;

type NavigationItem = {
  to: string;
  label: string;
  icon: NavIcon;
};

const identityGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Operate",
    items: [
      {
        to: "/identity-access/work-queue",
        label: "Work queue",
        icon: InboxIcon,
      },
      {
        to: "/identity-access/people",
        label: "People",
        icon: UsersIcon,
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        to: "/identity-access/business-access",
        label: "Business access",
        icon: ShieldIcon,
      },
      {
        to: "/identity-access/privileged-access",
        label: "Privileged access",
        icon: ShieldAlertIcon,
      },
    ],
  },
  {
    label: "Assure",
    items: [
      {
        to: "/identity-access/reviews",
        label: "Reviews",
        icon: ClipboardCheckIcon,
      },
      {
        to: "/identity-access/activity",
        label: "Activity",
        icon: HistoryIcon,
      },
    ],
  },
];

export const adminGroups = [
  {
    key: "identity",
    to: "/identity-access/work-queue",
    label: "Identity & access",
    icon: IdCardIcon,
  },
  {
    key: "notifications",
    to: "/notifications/overview",
    label: "Notifications",
    icon: BellIcon,
  },
  {
    key: "subsidiaries",
    to: "/subsidiaries",
    label: "Subsidiaries",
    icon: Building2Icon,
  },
] as const satisfies readonly AppShellGroup[];

const contextualItemClass = "relative h-7";

export function adminGroupKey(pathname: string) {
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/subsidiaries")) return "subsidiaries";
  return "identity";
}

export function adminContextTitle(groupKey: string) {
  return (
    adminGroups.find((group) => group.key === groupKey)?.label ??
    "Identity & access"
  );
}

export function AdminContextNav({
  pathname,
  groupKey,
  onNavigate,
}: {
  pathname: string;
  groupKey: string;
  onNavigate?: () => void;
}) {
  if (groupKey === "subsidiaries") {
    return <SubsidiaryList onNavigate={onNavigate} />;
  }
  if (groupKey === "notifications") {
    return (
      <NotificationsNavigation onNavigate={onNavigate} pathname={pathname} />
    );
  }
  return <IdentityNavigation onNavigate={onNavigate} pathname={pathname} />;
}

export function AdminMobileNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarGroup className="px-2 py-0">
        <SidebarGroupLabel>Identity &amp; access</SidebarGroupLabel>
        <SidebarGroupContent>
          <IdentityNavigation onNavigate={onNavigate} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-3 my-2 w-auto" />
      <SidebarGroup className="px-2 py-0">
        <SidebarGroupLabel>Notifications</SidebarGroupLabel>
        <SidebarGroupContent>
          <NotificationsNavigation
            onNavigate={onNavigate}
            pathname={pathname}
          />
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-3 my-2 w-auto" />
      <SidebarGroup className="px-2 py-0">
        <SidebarGroupLabel>Subsidiaries</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/subsidiaries")}
                onClick={onNavigate}
                render={<Link to="/subsidiaries" />}
              >
                <NavGlyph icon={Building2Icon} />
                <span>Subsidiaries</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {pathname.startsWith("/subsidiaries") ? (
            <SubsidiaryList onNavigate={onNavigate} />
          ) : null}
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function IdentityNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return identityGroups.map((group, index) => (
    <div className={index === 0 ? "" : "mt-3"} key={group.label}>
      <p className="px-4 pb-1 font-medium text-[0.6875rem] text-muted-foreground">
        {group.label}
      </p>
      <SidebarMenu className="px-1.5">
        {group.items.map((area) => {
          const current = pathname.startsWith(area.to);

          return (
            <SidebarMenuItem key={area.to}>
              <SidebarMenuButton
                isActive={current}
                onClick={onNavigate}
                render={<Link to={area.to} />}
                size="sm"
              >
                <NavGlyph icon={area.icon} />
                <span>{area.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  ));
}

function NotificationsNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const items = [
    {
      icon: LayoutDashboardIcon,
      label: "Overview",
      to: "/notifications/overview",
    },
    {
      icon: LogsIcon,
      label: "Delivery log",
      to: "/notifications/delivery",
    },
    {
      icon: LayoutTemplateIcon,
      label: "Templates",
      to: "/notifications/templates",
    },
    {
      icon: BellOffIcon,
      label: "Suppressions",
      to: "/notifications/suppressions",
    },
  ] as const;

  return (
    <SidebarMenu className="px-1.5">
      {items.map((item) => {
        const current = pathname.startsWith(item.to);
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              isActive={current}
              onClick={onNavigate}
              render={<Link to={item.to} />}
              size="sm"
            >
              <NavGlyph icon={item.icon} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SubsidiaryList({ onNavigate }: { onNavigate?: () => void } = {}) {
  const directory = useQuery(directoryQueryOptions);
  const current = useRouterState({
    select: (state) => (state.location.search as { id?: string }).id,
  });
  const subsidiaries = directory.data?.subsidiaries ?? [];

  if (subsidiaries.length === 0) return null;

  return (
    <SidebarMenu className="px-1.5">
      {subsidiaries.map((subsidiary, index) => (
        <SidebarMenuItem key={subsidiary.id}>
          <SidebarMenuButton
            className={contextualItemClass}
            data-nav="context"
            isActive={current ? current === subsidiary.id : index === 0}
            onClick={onNavigate}
            size="sm"
            render={<Link search={{ id: subsidiary.id }} to="/subsidiaries" />}
          >
            <span>{subsidiary.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
