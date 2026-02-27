import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard-content";
import { TradingViewChart } from "@/components/trading-view-chart";

export const metadata: Metadata = {
  title: "Dashboard | Tagaroa Investment",
  description: "Investment portfolio dashboard — NAV, positions, P&L overview",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardContent />
    </div>
  );
}
