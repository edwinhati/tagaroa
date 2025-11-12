"use client";

import dynamic from "next/dynamic";

const HeroSection = dynamic(
  () => import("@/components/hero-section").then((mod) => mod.HeroSection),
  { ssr: false },
);

export default function ClientHomePage() {
  return (
    <div>
      <HeroSection />
    </div>
  );
}
