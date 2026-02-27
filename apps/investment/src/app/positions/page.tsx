import type { Metadata } from "next";
import { PositionsTable } from "@/components/positions-table";

export const metadata: Metadata = {
  title: "Positions | Tagaroa Investment",
  description: "View all open positions across portfolios",
};

export default function PositionsPage() {
  return <PositionsTable />;
}
