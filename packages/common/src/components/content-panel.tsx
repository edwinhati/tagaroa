"use client";

import React from "react";
import Link from "next/link";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@repo/ui/components/resizable";
import {
  SidebarHeader,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@repo/ui/components/sidebar";

interface ContentPanelProps {
  contentTitle: string;
  contentLabel: string;
  children: React.ReactNode;
  menu: Array<{ name: string; icon?: React.ComponentType; href: string }>;
}

export function ContentPanel({
  contentTitle,
  contentLabel,
  children,
  menu,
}: ContentPanelProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
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
                {menu.map((item, index) => (
                  <SidebarMenuItem key={index}>
                    <Link href={item.href}>
                      <SidebarMenuButton>
                        {item.icon && <item.icon />}
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
