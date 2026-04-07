"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

export default function AssetsTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ContentPanel
      contentTitle="Asset Management"
      contentLabel="Overview"
      menu={[{ name: "Assets", href: "/assets" }]}
    >
      {children}
    </ContentPanel>
  );
}
