"use client";

import { AppNavbar } from "@repo/common/components/app-navbar";
import { AppSidebar } from "@repo/common/components/app-sidebar";
import { BudgetProvider } from "@repo/common/providers/budget-provider";
import { FilterProvider } from "@repo/common/providers/filter-provider";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import {
  ArrowLeftRight,
  Building2,
  Home,
  Landmark,
  Scale,
  Wallet,
} from "lucide-react";

const nav = [
  { name: "Home", icon: Home, href: "/" },
  { name: "Accounts", icon: Building2, href: "/accounts" },
  { name: "Budgets", icon: Wallet, href: "/budgets" },
  { name: "Transactions", icon: ArrowLeftRight, href: "/transactions" },
  { name: "Assets", icon: Landmark, href: "/assets" },
  { name: "Liabilities", icon: Scale, href: "/liabilities" },
];

export default function RootTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <FilterProvider>
        <BudgetProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar appName="Finance" nav={nav} />
            <SidebarInset>
              <AppNavbar />
              <div className="flex flex-1 flex-col">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </BudgetProvider>
      </FilterProvider>
    </div>
  );
}
