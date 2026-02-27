"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { IconShieldLock } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

const nav = [
  { name: "Authentication", icon: IconShieldLock, href: "/auth/users" },
];

export default function RootTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const currentPath = usePathname();

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar appName="Administrator" nav={nav} />
        <SidebarInset>
          <AppNavbar
            nav={nav.map((item) => ({ name: item.name, href: item.href }))}
            currentPath={currentPath}
          />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
