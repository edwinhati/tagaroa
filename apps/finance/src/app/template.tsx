"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { BudgetProvider } from "@repo/common/providers/budget-provider";
import { FilterProvider } from "@repo/common/providers/filter-provider";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import {
  IconBuildingBank,
  IconCreditCard,
  IconHome,
  IconStack2,
  IconTransfer,
  IconWallet,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";

const nav = [
  { name: "Dashboard", icon: IconHome, href: "/" },
  { name: "Accounts", icon: IconBuildingBank, href: "/accounts" },
  { name: "Budgets", icon: IconWallet, href: "/budgets" },
  { name: "Transactions", icon: IconTransfer, href: "/transactions" },
  { name: "Assets", icon: IconStack2, href: "/assets" },
  { name: "Liabilities", icon: IconCreditCard, href: "/liabilities" },
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
      <FilterProvider>
        <BudgetProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar appName="Finance" nav={nav} />
            <SidebarInset>
              <AppNavbar nav={navForNavbar} currentPath={pathname} />
              <div className="flex flex-1 flex-col">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </BudgetProvider>
      </FilterProvider>
    </div>
  );
}
