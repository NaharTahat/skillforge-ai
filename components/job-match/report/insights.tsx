import { Check, Lightbulb, MessagesSquare, Minus, ThumbsUp } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobMatchReport } from "@/lib/job-match/schema";

export function RoleOverviewCard({ report }: { report: JobMatchReport }) {
  const required = report.requirements.filter((r) => r.kind === "REQUIRED").length;
  const preferred = report.requirements.length - required;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          About this role
        </CardTitle>
        <CardDescription>Extracted from the job description</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm leading-relaxed">{report.summary}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Requirements</dt>
            <dd className="mt-0.5">
              {required} required · {preferred} preferred
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Experience asked for</dt>
            <dd className="mt-0.5">
              {report.experienceRequirement.description ??
                (report.experienceRequirement.yearsMin !== null
                  ? `${report.experienceRequirement.yearsMin}+ years`
                  : "Not specified")}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Education asked for</dt>
            <dd className="mt-0.5">{report.educationRequirement.description ?? "Not specified"}</dd>
          </div>
        </dl>
        {report.responsibilities.length > 0 && (
          <div>
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Responsibilities
            </h3>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-sm marker:text-muted-foreground">
              {report.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KeywordCoverageCard({ coverage }: { coverage: JobMatchReport["keywordCoverage"] }) {
  const total = coverage.matched.length + coverage.missing.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Keyword coverage
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "No keywords identified"
            : `${coverage.matched.length} of ${total} job keywords appear in your CV (checked word-for-word)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-2" aria-label="Job keywords">
          {coverage.matched.map((k) => (
            <li key={`m-${k}`}>
              <Badge variant="outline" className="gap-1 border-success/40 font-normal">
                <Check className="size-3 text-success" aria-hidden />
                {k}
                <span className="sr-only">(in your CV)</span>
              </Badge>
            </li>
          ))}
          {coverage.missing.map((k) => (
            <li key={`x-${k}`}>
              <Badge
                variant="outline"
                className="gap-1 border-dashed font-normal text-muted-foreground"
              >
                <Minus className="size-3" aria-hidden />
                {k}
                <span className="sr-only">(not in your CV)</span>
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function StrengthsCard({ strengths }: { strengths: JobMatchReport["strengths"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Strengths for this role
        </CardTitle>
      </CardHeader>
      <CardContent>
        {strengths.length === 0 ? (
          <EmptyState
            icon={ThumbsUp}
            title="No clear strengths identified"
            description="None of the job's requirements were clearly shown in your CV."
            className="py-8"
          />
        ) : (
          <ul className="grid gap-4">
            {strengths.map((s) => (
              <li key={s.area} className="flex gap-3">
                <ThumbsUp className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.area}</p>
                  <p className="text-xs text-muted-foreground">{s.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
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
  recommendations: JobMatchReport["recommendations"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Recommendations
        </CardTitle>
        <CardDescription>
          Only add skills or experience to your CV that you genuinely have.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations for this match.</p>
        ) : (
          <ol className="grid gap-3">
            {(["HIGH", "MEDIUM", "LOW"] as const).flatMap((priority) =>
              recommendations
                .filter((r) => r.priority === priority)
                .map((r) => (
                  <li key={`${priority}-${r.recommendation}`} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <Badge variant="outline" className={PRIORITY_META[priority].badge}>
                        {PRIORITY_META[priority].label}
                      </Badge>
                      <p className="min-w-0 text-sm font-medium">{r.recommendation}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r.reason}</p>
                  </li>
                )),
            )}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function InterviewTopicsCard({ topics }: { topics: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Likely interview topics
        </CardTitle>
        <CardDescription>
          Areas this job description suggests may come up — not guaranteed questions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No topics identified"
            description="The job description didn't point to specific technical areas."
            className="py-8"
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {topics.map((t) => (
              <li
                key={t}
                className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm"
              >
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
