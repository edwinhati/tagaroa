import React, { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import "@repo/ui/styles/globals.css";
import { Loading } from "@repo/common/components/loading";
import { geistMono, geistSans } from "@repo/common/lib/fonts";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
