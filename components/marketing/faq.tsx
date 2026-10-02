import { Section, SectionHeading } from "@/components/marketing/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Does SkillForge AI guarantee I'll get a job?",
    a: "No. SkillForge AI gives you an evidence-based view of your readiness and a plan to improve it. Match scores are estimates to guide your preparation, not predictions of hiring decisions.",
  },
  {
    q: "What happens to my CV?",
    a: "Your CV is private to your account. It is used only to generate your analysis and is never shown on your public Skill Passport. You can delete it at any time.",
  },
  {
    q: "Which file formats can I upload?",
    a: "PDF and DOCX files up to 5 MB.",
  },
  {
    q: "Which roles does the platform support?",
    a: "Any role with a job description. Interview practice and assessments currently focus on software, data, AI/ML and cybersecurity roles.",
  },
  {
    q: "Can I control what appears on my Skill Passport?",
    a: "Yes. Your passport is private by default. You choose whether it's public and which sections — projects, assessments, interview scores, roadmap — are shown.",
  },
] as const;

export function Faq() {
  return (
    <Section id="faq" className="border-t">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Can't find what you're looking for? Reach out and we'll help."
          align="left"
        />
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq) => (
            <AccordionItem key={faq.q} value={faq.q}>
              <AccordionTrigger className="text-left text-[15px]">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
