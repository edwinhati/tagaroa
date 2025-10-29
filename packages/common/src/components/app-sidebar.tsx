"use client";

import React from "react";
import Link from "next/link";
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

import { Logo } from "@repo/common/components/logo";
import { ThemeSwitcher } from "@repo/common/components/theme-switcher";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  appName: string;
  nav: Array<{ name: string; icon: React.ComponentType; href: string }>;
}

export function AppSidebar({ appName, nav, ...props }: AppSidebarProps) {
  const { open } = useSidebar();
  return (
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="#">
                <div>
                  <Logo size={28} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Tagaroa Capital</span>
                  <span className="truncate text-xs">{appName}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>{" "}
      </SidebarContent>
      <SidebarFooter>
        {open ? (
          <div className="flex justify-between">
            <SidebarTrigger variant="outline" className="w-9 h-9" />
            <ThemeSwitcher />
          </div>
        ) : (
          <div className="space-y-2">
            <ThemeSwitcher />
            <SidebarTrigger variant="outline" className="w-9 h-9" />
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
