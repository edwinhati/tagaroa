import type { Metadata } from "next";
import { LiabilityDataTable } from "@/components/liability-data-table";

export const metadata: Metadata = {
  title: "Liabilities | Tagaroa Finance",
  description: "Track and manage your financial liabilities",
};

export default function LiabilitiesPage() {
  return <LiabilityDataTable />;
}
