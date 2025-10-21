"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { AppProvider } from "@repo/common/providers/app-provider";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/sidebar";
import { DoorClosedLockedIcon } from "lucide-react";

const nav = [
  { name: "Authentication", icon: DoorClosedLockedIcon, href: "/auth/users" },
];

export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar appName="Administrator" nav={nav} />
        <SidebarInset>
          <AppNavbar />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>{" "}
    </AppProvider>
  );
}
