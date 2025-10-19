"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { FingerprintIcon, UsersIcon } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";

export default function AuthTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const oidcAdministratorFlagEnabled =
    useFeatureFlagEnabled("oidc-administator");

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={15}>
          <SidebarHeader>
            <span className="text-base font-semibold ml-2">Authentication</span>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>MANAGE</SidebarGroupLabel>
              <SidebarGroupContent className="flex flex-col">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link href="/auth/users">
                      <SidebarMenuButton>
                        <UsersIcon className="w-4 h-4 mr-2" />
                        <span>Users</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  {mounted && oidcAdministratorFlagEnabled && (
                    <SidebarMenuItem>
                      <Link href="/auth/oidc">
                        <SidebarMenuButton>
                          <FingerprintIcon className="w-4 h-4 mr-2" />
                          <span>OIDC Clients</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </SidebarContent>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={85} className="p-4">
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
}
