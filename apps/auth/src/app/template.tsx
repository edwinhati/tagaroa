"use client";

import { AppProvider } from "@repo/common/providers/app-provider";

type RootTemplateProps = Readonly<{ children: React.ReactNode }>;

export default function RootTemplate({ children }: RootTemplateProps) {
  return <AppProvider>{children}</AppProvider>;
}
