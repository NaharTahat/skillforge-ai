import { Cta } from "@/components/marketing/cta";
import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Overview } from "@/components/marketing/overview";
import { Pricing } from "@/components/marketing/pricing";
import { Spotlights } from "@/components/marketing/spotlights";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Overview />
      <HowItWorks />
      <Features />
      <Spotlights />
      <Pricing />
      <Faq />
      <Cta />
    </>
  );
}
