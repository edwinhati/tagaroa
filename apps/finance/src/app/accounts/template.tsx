"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

type AccountTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function AccountTemplate({ children }: AccountTemplateProps) {
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
