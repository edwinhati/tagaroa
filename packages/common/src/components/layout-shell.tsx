import "@repo/ui/styles/globals.css";
import type React from "react";
import { Suspense } from "react";
import { Loading } from "@repo/common/components/loading";
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
			<body className={`antialiased ${bodyClassName} mr-2`}>
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
