import { Section, SectionHeading } from "@/components/marketing/section";

const steps = [
  {
    title: "Upload your CV",
    description: "PDF or DOCX. We extract the text and map it to a structured skill profile.",
  },
  {
    title: "Pick a target role",
    description: "Paste a job description or choose a goal like AI Engineer or Data Analyst.",
  },
  {
    title: "Follow your roadmap",
    description: "Work through a sequenced plan with estimated hours for every step.",
  },
  {
    title: "Prove it",
    description: "Take assessments, practice interviews and publish your Skill Passport.",
  },
] as const;

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="border-y bg-muted/20">
      <SectionHeading eyebrow="How it works" title="From CV to interview-ready in four steps" />
      <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative rounded-2xl border bg-card p-6">
            <span className="font-mono text-xs text-brand">0{index + 1}</span>
            <h3 className="mt-3 font-medium">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
