import type { Metadata } from "next";
import { LayoutShell } from "@repo/common/components/layout-shell";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/sidebar";

import { AdminNavbar } from "@/components/admin-navbar";
import { AdminSidebar } from "@/components/admin-sidebar";

export const metadata: Metadata = {
  title: "Tagaroa - Administrator",
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <LayoutShell>
      <SidebarProvider defaultOpen={false}>
        <AdminSidebar />
        <SidebarInset>
          <AdminNavbar />
          <div className="flex flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>{" "}
    </LayoutShell>
  );
}
