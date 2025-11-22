"use client";

import { ContentPanel } from "@repo/common/components/content-panel";
import { BudgetProvider } from "@repo/common/providers/budget-provider";

type BudgetTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function BudgetTemplate({ children }: BudgetTemplateProps) {
  const menu = [
    {
      name: "Budget",
      href: "/budgets",
    },
    {
      name: "History",
      href: "/budgets/history",
    },
  ];
  return (
    <BudgetProvider>
      <ContentPanel
        contentTitle="Budget Management"
        contentLabel="Overview"
        menu={menu}
      >
        {children}
      </ContentPanel>
    </BudgetProvider>
  );
}
