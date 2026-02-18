import type { Metadata } from "next";
import { TransactionDataTable } from "@/components/transaction-data-table";

export const metadata: Metadata = {
  title: "Transactions | Tagaroa Finance",
  description: "View and manage your financial transactions",
};

export default function TransactionPage() {
  return <TransactionDataTable />;
}
