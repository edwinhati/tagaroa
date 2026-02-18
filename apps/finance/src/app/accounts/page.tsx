import type { Metadata } from "next";
import { AccountDataTable } from "@/components/account-data-table";

export const metadata: Metadata = {
  title: "Accounts | Tagaroa Finance",
  description: "Manage your financial accounts",
};

export default function AccountPage() {
  return <AccountDataTable />;
}
