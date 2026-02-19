"use client";

import { ContentPanel } from "@repo/common/components/content-panel";
import { IconUsers } from "@tabler/icons-react";

export default function AuthTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const menu = [
    {
      name: "Users",
      icon: IconUsers,
      href: "/auth/users",
    },
  ];
  return (
    <ContentPanel
      contentTitle="Authentication"
      contentLabel="MANAGE"
      menu={menu}
    >
      {children}
    </ContentPanel>
  );
}
