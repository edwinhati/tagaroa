import "@repo/ui/styles/globals.css";
import React, { Suspense } from "react";
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
}: Readonly<LayoutShellProps>) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${bodyClassName} mr-1`}
      >
        <AppProvider>
          <Suspense
            fallback={
              <div
                className="fixed inset-0 flex items-center justify-center"
                style={{ height: "100vh", width: "100vw" }}
              >
                <Loading />
              </div>
            }
          >
            {children}
          </Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
