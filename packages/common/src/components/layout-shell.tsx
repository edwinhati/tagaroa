import "@repo/ui/styles/globals.css";
import { Loading } from "@repo/common/components/loading";
import { AppProvider } from "@repo/common/providers/app-provider";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import { type ReactNode, Suspense } from "react";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

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
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${sora.variable} ${plusJakarta.variable}`}
    >
      <body
        className={["antialiased font-body", bodyClassName]
          .filter(Boolean)
          .join(" ")}
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
