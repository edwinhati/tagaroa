"use client";

import { ContentPanel } from "@repo/common/components/content-panel";
import { UsersIcon } from "lucide-react";

export default function AuthTemplate({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const menu = [
    {
      name: "Users",
      icon: UsersIcon,
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
