"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import {
  IconBriefcase,
  IconCoins,
  IconHome,
  IconListDetails,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";

const nav = [
  { name: "Dashboard", icon: IconHome, href: "/" },
  { name: "Portfolios", icon: IconBriefcase, href: "/portfolios" },
  { name: "Positions", icon: IconListDetails, href: "/positions" },
  { name: "Market", icon: IconCoins, href: "/market" },
];

const navForNavbar = nav.map(({ name, href }) => ({ name, href }));

export default function RootTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar appName="Investment" nav={nav} />
        <SidebarInset>
          <AppNavbar nav={navForNavbar} currentPath={pathname} />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
