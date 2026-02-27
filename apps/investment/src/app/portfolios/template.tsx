"use client";

import { ContentPanel } from "@repo/common/components/content-panel";

type PortfoliosTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function PortfoliosTemplate({
  children,
}: PortfoliosTemplateProps) {
  return (
    <ContentPanel
      contentTitle="Portfolio Management"
      contentLabel="Overview"
      menu={[{ name: "Portfolios", href: "/portfolios" }]}
    >
      {children}
    </ContentPanel>
  );
}
