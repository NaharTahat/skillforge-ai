import type { ReactNode } from "react";
import { BadgeCheck, Check, Minus, Mic } from "lucide-react";
import { FeatureList, Section, SectionHeading } from "@/components/marketing/section";
import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SpotlightProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  visual: ReactNode;
  reverse?: boolean;
  className?: string;
};

function Spotlight({
  id,
  eyebrow,
  title,
  description,
  points,
  visual,
  reverse,
  className,
}: SpotlightProps) {
  return (
    <Section id={id} className={className}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className={cn(reverse && "lg:order-2")}>
          <SectionHeading eyebrow={eyebrow} title={title} description={description} align="left" />
          <FeatureList items={points} />
        </div>
        <div className={cn(reverse && "lg:order-1")}>
          <VisualFrame>{visual}</VisualFrame>
        </div>
      </div>
    </Section>
  );
}

function VisualFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div aria-hidden className="absolute inset-6 -z-10 rounded-full bg-brand/10 blur-3xl" />
      <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-black/10 sm:p-6">
        {children}
        <p className="mt-5 text-[11px] text-muted-foreground">Illustrative example</p>
      </div>
    </div>
  );
}

// ─── Visuals ─────────────────────────────────────────────────────────────────

function CareerIntelligenceVisual() {
  const insights = [
    { label: "Strength", text: "Production Python with measurable impact" },
    { label: "Gap", text: "No evidence of cloud deployment" },
    { label: "Fix", text: "Quantify results in your two most recent roles" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5">
        <ReadinessRing value={78} size={88} label="CV score" />
        <div>
          <p className="text-sm font-medium">CV score</p>
          <p className="text-xs text-muted-foreground">
            Based on structure, evidence and relevance
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {insights.map((insight) => (
          <div
            key={insight.text}
            className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <Badge variant="secondary" className="shrink-0">
              {insight.label}
            </Badge>
            <p className="text-sm">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobMatchVisual() {
  const skills = [
    { name: "Python", matched: true },
    { name: "PyTorch", matched: true },
    { name: "SQL", matched: true },
    { name: "Docker", matched: false },
    { name: "AWS", matched: false },
    { name: "MLOps", matched: false },
  ] as const;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium">Machine Learning Engineer</p>
          <p className="text-xs text-muted-foreground">Estimated match</p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">68%</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[68%] rounded-full bg-linear-to-r from-brand to-brand-2" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {skills.map((skill) => (
          <div
            key={skill.name}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              skill.matched ? "bg-success/5" : "border-dashed text-muted-foreground",
            )}
          >
            {skill.matched ? (
              <Check className="size-3.5 text-success" aria-label="Matched" />
            ) : (
              <Minus className="size-3.5" aria-label="Missing" />
            )}
            {skill.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewVisual() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Technical</Badge>
        <Badge variant="outline">Mid-level</Badge>
        <span className="ml-auto text-xs text-muted-foreground">Question 3 of 8</span>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">
          How would you detect and handle data drift in a model serving production traffic?
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Mic className="size-4" /> Your answer…
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Clarity", "8/10"],
          ["Depth", "7/10"],
          ["Structure", "9/10"],
        ].map(([label, score]) => (
          <div key={label} className="rounded-lg border p-2.5">
            <p className="font-semibold tabular-nums">{score}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PassportVisual() {
  const skills = [
    ["Python", "Advanced"],
    ["Machine Learning", "Intermediate"],
    ["SQL", "Intermediate"],
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-linear-to-br from-brand to-brand-2 font-semibold text-primary-foreground">
          AK
        </div>
        <div>
          <p className="font-medium">Alex Kim</p>
          <p className="text-xs text-muted-foreground">Aspiring AI Engineer</p>
        </div>
        <Badge variant="secondary" className="ml-auto gap-1">
          <BadgeCheck className="size-3.5 text-brand" /> Verified
        </Badge>
      </div>
      <div className="mt-6 divide-y rounded-lg border">
        {skills.map(([skill, level]) => (
          <div key={skill} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{skill}</span>
            <span className="text-muted-foreground">{level}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 truncate font-mono text-xs text-muted-foreground">
        skillforge.ai/passport/alexkim
      </p>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

export function Spotlights() {
  return (
    <>
      <Spotlight
        id="intelligence"
        eyebrow="AI career intelligence"
        title="A clear, honest read of your CV"
        description="Structured analysis that separates what your CV proves from what it only claims — so you know what to fix first."
        points={[
          "Skill extraction with evidence from your experience",
          "Strengths, gaps and formatting issues in one view",
          "Prioritized, specific improvement suggestions",
        ]}
        visual={<CareerIntelligenceVisual />}
      />
      <Spotlight
        id="job-match"
        eyebrow="Job match"
        title="Know your fit before you apply"
        description="Compare your CV against any job description. See matching and missing skills, keyword coverage and experience requirements."
        points={[
          "Estimated match percentage with a transparent breakdown",
          "Experience and education requirements surfaced",
          "Recommendations to strengthen your application",
        ]}
        visual={<JobMatchVisual />}
        reverse
        className="border-y bg-muted/20"
      />
      <Spotlight
        id="interview"
        eyebrow="AI interview"
        title="Practice the interview before the interview"
        description="Role-specific technical, behavioral or mixed interviews with scored, actionable feedback on every answer."
        points={[
          "Questions tailored to role and experience level",
          "Per-answer scores, strengths and improvements",
          "Track your performance across sessions",
        ]}
        visual={<InterviewVisual />}
      />
      <Spotlight
        id="passport"
        eyebrow="Skill passport"
        title="A public profile backed by evidence"
        description="Share one link that shows your skills, assessment results and projects. You decide exactly what is visible."
        points={[
          "Assessment-verified skill levels",
          "Portfolio projects linked to the skills they prove",
          "Granular public / private visibility controls",
        ]}
        visual={<PassportVisual />}
        reverse
        className="border-y bg-muted/20"
      />
    </>
  );
}
