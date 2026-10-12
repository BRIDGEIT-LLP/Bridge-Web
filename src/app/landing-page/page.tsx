import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/landing/marketing/MarketingLandingPage";

export const metadata: Metadata = {
  title: "Bridge — Where businesses, startups & investors connect",
  description:
    "Bridge matches startups, investors, and B2B partners with verified counterparts across 20+ industries and 35+ countries.",
};

export default function LandingPageRoute() {
  return <MarketingLandingPage />;
}
