"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import {
  ArrowLeftRightIcon,
  HouseIcon,
  ListTreeIcon,
  WalletCardsIcon,
} from "lucide-react";

const nav = [
  { name: "Home", icon: HouseIcon, href: "/" },
  { name: "Accounts", icon: WalletCardsIcon, href: "/accounts" },
  { name: "Budgets", icon: ListTreeIcon, href: "/budgets" },
  { name: "Transactions", icon: ArrowLeftRightIcon, href: "/transactions" },
];

export default function RootTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar appName="Finance" nav={nav} />
        <SidebarInset>
          <AppNavbar />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
