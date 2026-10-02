import { CircleCheck, CircleHelp, CircleMinus, CircleX, ThumbsUp } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GAP_TYPES, PRIORITIES, type CvAnalysisReport } from "@/lib/cv/analysis-schema";
import { cn } from "@/lib/utils";

export function StrengthsCard({ strengths }: { strengths: CvAnalysisReport["strengths"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Strengths
        </CardTitle>
        <CardDescription>Backed by quotes from your CV</CardDescription>
      </CardHeader>
      <CardContent>
        {strengths.length === 0 ? (
          <EmptyState
            icon={ThumbsUp}
            title="No evidenced strengths"
            description="Nothing could be quoted as a clear strength. The recommendations below show how to make them visible."
            className="py-8"
          />
        ) : (
          <ul className="grid gap-4">
            {strengths.map((s) => (
              <li key={s.title} className="flex gap-3">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <blockquote className="mt-1 border-l-2 border-success/40 pl-2 text-xs text-muted-foreground">
                    “{s.evidence}”
                  </blockquote>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const GAP_META = {
  MISSING: {
    label: "Missing",
    description: "Expected for your apparent target and absent",
    icon: CircleX,
    tone: "text-destructive",
  },
  WEAK: {
    label: "Weak",
    description: "Present but thin or vague",
    icon: CircleMinus,
    tone: "text-warning",
  },
  NOT_SPECIFIED: {
    label: "Not specified",
    description: "Your CV doesn't say — not necessarily a gap",
    icon: CircleHelp,
    tone: "text-muted-foreground",
  },
} as const;

export function GapsCard({ gaps }: { gaps: CvAnalysisReport["gaps"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Missing &amp; weak areas
        </CardTitle>
        <CardDescription>
          What the CV lacks, kept separate from what it simply doesn&apos;t say
        </CardDescription>
      </CardHeader>
      <CardContent>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No significant gaps were identified.</p>
        ) : (
          <div className="grid gap-5">
            {GAP_TYPES.map((type) => {
              const items = gaps.filter((g) => g.type === type);
              if (items.length === 0) return null;
              const meta = GAP_META[type];
              return (
                <section key={type} aria-label={meta.label}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <h3 className={cn("text-sm font-medium", meta.tone)}>{meta.label}</h3>
                    <span className="text-xs text-muted-foreground">{meta.description}</span>
                  </div>
                  <ul className="grid gap-2.5">
                    {items.map((gap) => (
                      <li key={gap.area} className="flex gap-3">
                        <meta.icon
                          className={cn("mt-0.5 size-4 shrink-0", meta.tone)}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm">{gap.area}</p>
                          <p className="text-xs text-muted-foreground">{gap.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PRIORITY_META = {
  HIGH: {
    label: "High priority",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  MEDIUM: { label: "Medium priority", badge: "border-warning/30 bg-warning/10 text-warning" },
  LOW: { label: "Low priority", badge: "text-muted-foreground" },
} as const;

export function RecommendationsCard({
  recommendations,
}: {
  recommendations: CvAnalysisReport["recommendations"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Recommendations
        </CardTitle>
        <CardDescription>Ordered by expected impact on this CV</CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations — nice work.</p>
        ) : (
          <ol className="grid gap-3">
            {PRIORITIES.flatMap((priority) =>
              recommendations
                .filter((r) => r.priority === priority)
                .map((r) => (
                  <li key={`${priority}-${r.title}`} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={PRIORITY_META[priority].badge}>
                        {PRIORITY_META[priority].label}
                      </Badge>
                      <p className="text-sm font-medium">{r.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r.detail}</p>
                  </li>
                )),
            )}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
