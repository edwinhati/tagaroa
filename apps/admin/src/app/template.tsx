"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { DoorClosedLockedIcon } from "lucide-react";

const nav = [
  { name: "Authentication", icon: DoorClosedLockedIcon, href: "/auth/users" },
];

export default function RootTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar appName="Administrator" nav={nav} />
        <SidebarInset>
          <AppNavbar />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
