import { LayoutShell } from "@repo/common/components/layout-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tagaroa - Authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <LayoutShell>{children}</LayoutShell>;
}
