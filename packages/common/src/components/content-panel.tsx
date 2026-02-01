"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/resizable";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@repo/ui/components/sidebar";
import Link from "next/link";
import * as React from "react";
import { type ComponentType, type ReactNode } from "react";

type ContentPanelMenuItem = {
  name: string;
  icon?: ComponentType<{ className?: string }>;
  href: string;
};

type ContentPanelProps = Readonly<{
  contentTitle: string;
  contentLabel: string;
  children: ReactNode;
  menu: ContentPanelMenuItem[];
}>;

export function ContentPanel({
  contentTitle,
  contentLabel,
  children,
  menu,
}: ContentPanelProps) {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full border rounded-md mb-2"
    >
      <ResizablePanel minSize={15} maxSize={50} defaultSize={15}>
        <SidebarHeader>
          <span className="text-base font-semibold ml-2">{contentTitle}</span>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{contentLabel}</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col">
              <SidebarMenu>
                {menu.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href}>
                      <SidebarMenuButton>
                        {item.icon && <item.icon className="h-4 w-4" />}
                        <span>{item.name}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
        </SidebarContent>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        minSize={50}
        maxSize={85}
        defaultSize={85}
        className="p-4"
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
