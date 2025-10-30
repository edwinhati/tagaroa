"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

export default function AccountTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const menu = [
    {
      name: "Accounts",
      href: "/accounts",
    },
  ];
  return (
    <ContentPanel
      contentTitle="Account Management"
      contentLabel="Overview"
      menu={menu}
    >
      {children}
    </ContentPanel>
  );
}
