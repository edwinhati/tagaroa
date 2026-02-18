import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard | Tagaroa Finance",
  description: "Financial overview and insights for your accounts",
};

export default function HomePage() {
  return (
    <div className="flex-1 space-y-4 p-2">
      <DashboardContent />
    </div>
  );
}
