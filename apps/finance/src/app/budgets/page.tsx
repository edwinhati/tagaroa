import type { Metadata } from "next";
import { BudgetDataTable } from "@/components/budget-data-table";

export const metadata: Metadata = {
  title: "Budgets | Tagaroa Finance",
  description: "Plan and track your budget allocations",
};

export default function BudgetPage() {
  return <BudgetDataTable />;
}
