"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

export default function LiabilitiesTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentPanel
      contentTitle="Liability Management"
      contentLabel="Overview"
      menu={[{ name: "Liabilities", href: "/liabilities" }]}
    >
      {children}
    </ContentPanel>
  );
}
