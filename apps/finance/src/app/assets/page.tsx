import type { Metadata } from "next";
import { AssetDataTable } from "@/components/asset-data-table";

export const metadata: Metadata = {
  title: "Assets | Tagaroa Finance",
  description: "Track and manage your financial assets",
};

export default function AssetsPage() {
  return <AssetDataTable />;
}
