"use client";

import { AppProvider } from "@repo/common/providers/app-provider";

export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppProvider>{children}</AppProvider>;
}
