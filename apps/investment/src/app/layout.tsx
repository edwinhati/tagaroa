import { LayoutShell } from "@repo/common/components/layout-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tagaroa - Investment",
  description: "Quant investment platform — portfolios, positions, market data",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <LayoutShell>{children}</LayoutShell>;
}
