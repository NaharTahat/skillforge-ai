import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportRequirement } from "@/lib/job-match/schema";
import { cn } from "@/lib/utils";

const LEVELS = [
  {
    match: "PRESENT",
    title: "Found in your CV",
    description: "The CV clearly shows these requirements",
    icon: CircleCheck,
    tone: "text-success",
  },
  {
    match: "PARTIAL",
    title: "Partially shown",
    description: "Related evidence exists, but it doesn't clearly meet the requirement",
    icon: CircleDashed,
    tone: "text-warning",
  },
  {
    match: "MISSING",
    title: "Not found in your CV",
    description: "The CV doesn't mention these — that doesn't mean you lack them",
    icon: CircleX,
    tone: "text-destructive",
  },
] as const;

const IMPORTANCE_LABELS = {
  CRITICAL: "Critical",
  IMPORTANT: "Important",
  NICE_TO_HAVE: "Nice to have",
} as const;

function RequirementItem({ r }: { r: ReportRequirement }) {
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{r.term}</p>
        <Badge variant="outline" className="font-normal">
          {r.kind === "REQUIRED" ? "Required" : "Preferred"}
        </Badge>
        <Badge variant="secondary" className="font-normal">
          {IMPORTANCE_LABELS[r.importance]}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">From the job description</dt>
          <dd className="mt-0.5 border-l-2 border-muted-foreground/30 pl-2">
            “{r.evidenceFromJob}”
          </dd>
        </div>
        {r.evidenceFromCv && (
          <div>
            <dt className="text-muted-foreground">Evidence in your CV</dt>
            <dd className="mt-0.5 border-l-2 border-success/40 pl-2">“{r.evidenceFromCv}”</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{r.explanation}</p>
    </li>
  );
}

export function RequirementsSection({ requirements }: { requirements: ReportRequirement[] }) {
  const order = { CRITICAL: 0, IMPORTANT: 1, NICE_TO_HAVE: 2 } as const;
  const sorted = [...requirements].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "REQUIRED" ? -1 : 1) ||
      order[a.importance] - order[b.importance],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Requirements compared
        </CardTitle>
        <CardDescription>
          {requirements.length} requirement{requirements.length === 1 ? "" : "s"} identified in the
          job description, each checked against your CV
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8">
        {requirements.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No specific requirements could be identified in this job description.
          </p>
        )}
        {LEVELS.map((level) => {
          const items = sorted.filter((r) => r.match === level.match);
          if (items.length === 0) return null;
          return (
            <section key={level.match} aria-labelledby={`req-${level.match}`}>
              <div className="mb-3 flex items-start gap-2">
                <level.icon className={cn("mt-0.5 size-4 shrink-0", level.tone)} aria-hidden />
                <div>
                  <h3 id={`req-${level.match}`} className="text-sm font-medium">
                    {level.title} <span className="text-muted-foreground">({items.length})</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </div>
              </div>
              <ul className="grid gap-3 lg:grid-cols-2">
                {items.map((r) => (
                  <RequirementItem key={`${r.kind}-${r.term}`} r={r} />
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
