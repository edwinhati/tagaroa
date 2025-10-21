"use client";

import { FingerprintIcon, UsersIcon } from "lucide-react";
import { ContentPanel } from "@repo/common/components/content-panel";

export default function AuthTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const menu = [
    {
      name: "Users",
      icon: UsersIcon,
      href: "/auth/users",
    },
    {
      name: "OIDC",
      icon: FingerprintIcon,
      href: "/auth/oidc",
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
