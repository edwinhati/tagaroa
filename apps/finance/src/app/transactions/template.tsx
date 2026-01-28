"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

type TransactionTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function TransactionTemplate({
  children,
}: TransactionTemplateProps) {
  const menu = [
    {
      name: "Transactions",
      href: "/transactions",
    },
  ];
  return (
    <ContentPanel
      contentTitle="Transaction Management"
      contentLabel="Overview"
      menu={menu}
    >
      {children}
    </ContentPanel>
  );
}
