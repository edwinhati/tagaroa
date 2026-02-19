"use client";

import { ContentPanel } from "@repo/common/components/content-panel";
import { IconHistory, IconWallet } from "@tabler/icons-react";

type BudgetTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function BudgetTemplate({ children }: BudgetTemplateProps) {
  const menu = [
    {
      name: "Budget",
      icon: IconWallet,
      href: "/budgets",
    },
    {
      name: "History",
      icon: IconHistory,
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
