import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CvAnalysisReport } from "@/lib/cv/analysis-schema";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<keyof CvAnalysisReport["sections"], string> = {
  contact: "Contact details",
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

export function SectionsCard({ sections }: { sections: CvAnalysisReport["sections"] }) {
  const entries = Object.entries(SECTION_LABELS) as [keyof typeof SECTION_LABELS, string][];
  const found = entries.filter(([key]) => sections[key]).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          CV sections
        </CardTitle>
        <CardDescription>
          {found} of {entries.length} standard sections detected
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {entries.map(([key, label]) => (
            <li
              key={key}
              className={cn(
                "flex items-center gap-2 text-sm",
                !sections[key] && "text-muted-foreground",
              )}
            >
              {sections[key] ? (
                <Check className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Minus className="size-4 shrink-0" aria-hidden />
              )}
              {label}
              <span className="sr-only">{sections[key] ? "(detected)" : "(not detected)"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const FORMATTING_LABELS: Record<keyof CvAnalysisReport["formatting"], string> = {
  readability: "Readability",
  consistency: "Consistency",
  structure: "Structure",
};

export function FormattingCard({ formatting }: { formatting: CvAnalysisReport["formatting"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Formatting
        </CardTitle>
        <CardDescription>Rated 0–10</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {(Object.keys(FORMATTING_LABELS) as (keyof typeof FORMATTING_LABELS)[]).map((key) => (
            <li key={key}>
              <div className="flex justify-between text-sm">
                <span>{FORMATTING_LABELS[key]}</span>
                <span className="text-muted-foreground tabular-nums">{formatting[key]}/10</span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${FORMATTING_LABELS[key]}: ${formatting[key]} out of 10`}
              >
                <div
                  className="h-full rounded-full bg-brand-2"
                  style={{ width: `${formatting[key] * 10}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
