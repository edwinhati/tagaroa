"use client";

import { Logo } from "@repo/common/components/logo";
import { ThemeSwitcher } from "@repo/common/components/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/components/sidebar";
import Link from "next/link";
import * as React from "react";
import { type ComponentProps, type ComponentType } from "react";

type AppSidebarProps = Readonly<
  ComponentProps<typeof Sidebar> & {
    appName: string;
    nav: Array<{ name: string; icon: ComponentType; href: string }>;
  }
>;

export function AppSidebar({ appName, nav, ...props }: AppSidebarProps) {
  const { open } = useSidebar();
  return (
    <div>
      {/* Header panel — logo only */}
      <Sidebar className="h-16" variant="floating" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/" />}>
                <div className="[&>svg]:size-6! flex size-8 shrink-0 items-center justify-center">
                  <Logo size={28} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Tagaroa</span>
                  <span className="truncate text-xs">{appName}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      </Sidebar>

      {/* Nav panel — below header */}
      <Sidebar
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
        variant="floating"
        collapsible="icon"
        {...props}
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <Link href={item.href}>
                    <SidebarMenuButton tooltip={item.name}>
                      <item.icon />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {open ? (
            <div className="flex justify-between">
              <SidebarTrigger variant="outline" className="h-9 w-9" />
              <ThemeSwitcher />
            </div>
          ) : (
            <div className="space-y-2">
              <ThemeSwitcher />
              <SidebarTrigger variant="outline" className="h-9 w-9" />
            </div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </div>
  );
}
