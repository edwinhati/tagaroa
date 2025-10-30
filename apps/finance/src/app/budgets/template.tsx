"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

export default function BudgetTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
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
    <ContentPanel
      contentTitle="Budget Management"
      contentLabel="Overview"
      menu={menu}
    >
      {children}
    </ContentPanel>
  );
}
