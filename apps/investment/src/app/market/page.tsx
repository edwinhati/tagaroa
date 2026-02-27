import type { Metadata } from "next";
import { InstrumentBrowser } from "@/components/instrument-browser";

export const metadata: Metadata = {
  title: "Market | Tagaroa Investment",
  description: "Browse instruments — stocks, crypto, forex",
};

export default function MarketPage() {
  return <InstrumentBrowser />;
}
