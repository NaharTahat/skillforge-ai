import Link from "next/link";
import { Check } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/config/site";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: readonly string[];
  cta: string;
  highlighted?: boolean;
};

const plans: readonly Plan[] = [
  {
    name: "Free",
    price: "$0",
    description: "Get a baseline of where you stand.",
    features: [
      "1 CV analysis per month",
      "3 job matches per month",
      "Basic career roadmap",
      "Public Skill Passport",
    ],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    description: "For active job seekers who want an edge.",
    features: [
      "Unlimited CV analyses",
      "Unlimited job matches",
      "Personalized, adaptive roadmap",
      "Unlimited AI interview practice",
      "All skill assessments",
    ],
    cta: "Start Pro trial",
    highlighted: true,
  },
  {
    name: "Teams",
    price: "Custom",
    description: "For bootcamps, universities and career coaches.",
    features: ["Everything in Pro", "Cohort dashboards", "Custom assessments", "Priority support"],
    cta: "Contact us",
  },
];

export function Pricing() {
  return (
    <Section id="pricing">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans that grow with you"
        description="Start free. Upgrade when you're actively interviewing."
      />
      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-7",
              plan.highlighted && "border-brand/50 shadow-[0_0_60px_-20px] shadow-brand/40",
            )}
          >
            {plan.highlighted && (
              <Badge className="absolute -top-2.5 left-7 rounded-full">Most popular</Badge>
            )}
            <h3 className="font-medium">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            <p className="mt-6">
              <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
              {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              asChild
              size="lg"
              variant={plan.highlighted ? "default" : "outline"}
              className="mt-8 h-10"
            >
              <Link href={routes.getStarted}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Prices shown are indicative while the platform is in development.
      </p>
    </Section>
  );
}
