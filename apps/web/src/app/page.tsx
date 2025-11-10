import { HeroSection } from "@/components/hero-section";
import { FooterSection } from "@/components/footer-section";
import dynamic from "next/dynamic";

const HeaderSection = dynamic(
  () =>
    import("@/components/header-section").then((mod) => mod.HeaderSection),
  { ssr: false },
);

export default function HomePage() {
  return (
    <div>
      <HeaderSection />
      <HeroSection />
      <FooterSection />
    </div>
  );
}
