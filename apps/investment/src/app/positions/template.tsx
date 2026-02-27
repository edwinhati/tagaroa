"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

export default function PositionsTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ContentPanel
      contentTitle="Positions"
      contentLabel="All Portfolios"
      menu={[{ name: "Positions", href: "/positions" }]}
    >
      {children}
    </ContentPanel>
  );
}
