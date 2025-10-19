import React, { Suspense } from "react";
import "@repo/ui/styles/globals.css";
import { Loading } from "@repo/common/components/loading";
import { geistMono, geistSans } from "@repo/common/lib/fonts";
import { AppProvider } from "@repo/common/providers/app-provider";

type LayoutShellProps = {
  children: React.ReactNode;
  lang?: string;
  bodyClassName?: string;
};

export function LayoutShell({
  children,
  lang = "en",
  bodyClassName = "",
}: LayoutShellProps) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${bodyClassName}`}
      >
        <AppProvider>
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
