"use client";

import { ContentPanel } from "@repo/common/components/content-panel";
import { History, Wallet } from "lucide-react";

type BudgetTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function BudgetTemplate({ children }: BudgetTemplateProps) {
  const menu = [
    {
      name: "Budget",
      icon: Wallet,
      href: "/budgets",
    },
    {
      name: "History",
      icon: History,
      href: "/budgets/history",
    },
  ];
  return (
    <ContentPanel
      contentTitle="Budget Management"
      contentLabel="Overview"
      menu={menu}
    >
      {children}
    </ContentPanel>
  );
}
