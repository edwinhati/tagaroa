import type { Metadata } from "next";
import { PortfolioDetail } from "@/components/portfolio-detail";

export const metadata: Metadata = {
  title: "Portfolio Detail | Tagaroa Investment",
};

export default async function PortfolioDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <PortfolioDetail portfolioId={id} />;
}
