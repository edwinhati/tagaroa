import "@repo/ui/styles/globals.css";
import { Loading } from "@repo/common/components/loading";
import { AppProvider } from "@repo/common/providers/app-provider";
import type { ReactNode } from "react";
import { Suspense } from "react";

type LayoutShellProps = {
  children: ReactNode;
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
        className={["antialiased", bodyClassName].filter(Boolean).join(" ")}
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
