import type { Metadata } from "next";
import { BudgetHistoryDataTable } from "@/components/budget-history-data-table";

export const metadata: Metadata = {
  title: "Budget History | Tagaroa Finance",
  description: "View historical budget performance and trends",
};

export default function BudgetHistoryPage() {
  return <BudgetHistoryDataTable />;
}
