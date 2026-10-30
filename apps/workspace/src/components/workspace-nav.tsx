import { NavGlyph, type AppShellGroup } from "@repo/shell/app-shell";
import type { Domain } from "@repo/shell/domains";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { HouseIcon } from "lucide-react";

export const workspaceGroups = [
  {
    key: "home",
    to: "/",
    label: "Workspace",
    icon: HouseIcon,
  },
] as const satisfies readonly AppShellGroup[];

export function WorkspaceContextNav({
  domains,
  onNavigate,
}: {
  domains: Domain[];
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarMenu className="px-1.5">
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive
            onClick={onNavigate}
            render={<Link to="/" />}
            size="sm"
          >
            <NavGlyph icon={HouseIcon} />
            <span>Home</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div className="mt-3">
        <p className="px-4 pb-1 font-medium text-[0.6875rem] text-muted-foreground">
          Work areas
        </p>
        <DomainList domains={domains} onNavigate={onNavigate} />
      </div>
    </>
  );
}

export function WorkspaceMobileNav({
  domains,
  onNavigate,
}: {
  domains: Domain[];
  onNavigate?: () => void;
}) {
  return (
    <>
      <SidebarGroup className="px-2 py-0">
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive
                onClick={onNavigate}
                render={<Link to="/" />}
              >
                <NavGlyph icon={HouseIcon} />
                <span>Home</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="mt-3 px-2 py-0">
        <SidebarGroupLabel>Work areas</SidebarGroupLabel>
        <SidebarGroupContent>
          <DomainList domains={domains} onNavigate={onNavigate} />
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

function DomainList({
  domains,
  onNavigate,
}: {
  domains: Domain[];
  onNavigate?: () => void;
}) {
  if (domains.length === 0) {
    return (
      <p className="px-4 py-2 text-[0.75rem] text-muted-foreground">
        No work areas assigned yet.
      </p>
    );
  }

  return (
    <SidebarMenu className="px-1.5">
      {domains.map((domain) => (
        <SidebarMenuItem key={domain.slug}>
          {domain.live ? (
            <SidebarMenuButton
              onClick={onNavigate}
              render={<a href={`/${domain.slug}`} />}
              size="sm"
            >
              <span>{domain.label}</span>
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton aria-disabled size="sm">
              <span className="min-w-0 flex-1 truncate">{domain.label}</span>
              <span className="text-[0.6875rem] text-muted-foreground">
                Soon
              </span>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
