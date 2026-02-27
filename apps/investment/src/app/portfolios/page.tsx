import type { Metadata } from "next";
import { PortfolioList } from "@/components/portfolio-list";

export const metadata: Metadata = {
  title: "Portfolios | Tagaroa Investment",
  description: "Manage your investment portfolios",
};

export default function PortfoliosPage() {
  return <PortfolioList />;
}
