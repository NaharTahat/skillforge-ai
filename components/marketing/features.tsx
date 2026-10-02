import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/section";
import { dashboardNav } from "@/lib/config/navigation";
import { routes } from "@/lib/config/site";

// Reuse the product navigation as the single source of truth for feature copy.
const features = dashboardNav.filter((item) => item.href !== "/dashboard");

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to move to your next role"
        description="Each tool works on its own, and they get sharper together: your CV informs your roadmap, your roadmap informs your interviews."
      />
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-card p-6">
            <Icon className="size-5 text-brand" />
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
        {/* Completes the grid (7 features) with a real destination. */}
        <Link
          href={routes.getStarted}
          className="group flex flex-col justify-between gap-6 bg-brand/5 p-6 transition-colors outline-none hover:bg-brand/10 focus-visible:bg-brand/10"
        >
          <div>
            <h3 className="font-medium">See how it fits together</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a free account to explore your dashboard.
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-brand">
            Get started
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </Section>
  );
}
