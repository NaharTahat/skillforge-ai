import { Compass, Crosshair, TrendingUp } from "lucide-react";
import { Section, SectionHeading } from "@/components/marketing/section";

const pillars = [
  {
    icon: Crosshair,
    title: "Know where you stand",
    description:
      "A structured read of your CV: the skills it demonstrates, the evidence behind them, and what a recruiter is likely to miss.",
  },
  {
    icon: Compass,
    title: "See what roles require",
    description:
      "Paste any job description and get a side-by-side comparison of required versus demonstrated skills, keywords and experience.",
  },
  {
    icon: TrendingUp,
    title: "Close the gap deliberately",
    description:
      "Turn missing skills into a sequenced roadmap, then validate progress with assessments and practice interviews.",
  },
] as const;

export function Overview() {
  return (
    <Section id="product">
      <SectionHeading
        eyebrow="The platform"
        title="One place to plan, prove and present your skills"
        description="Job searching usually means guessing what employers want. SkillForge AI replaces guesswork with a clear, evidence-based picture of your readiness for a specific role."
      />
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-2xl border bg-card p-6">
            <div className="grid size-10 place-items-center rounded-lg bg-brand/10">
              <Icon className="size-5 text-brand" />
            </div>
            <h3 className="mt-5 font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
