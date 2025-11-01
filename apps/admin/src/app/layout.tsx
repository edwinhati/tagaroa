 import type { Metadata } from "next";
import { LayoutShell } from "@repo/common/components/layout-shell";

export const metadata: Metadata = {
  title: "Tagaroa - Administrator",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <LayoutShell>{children}</LayoutShell>;
}
