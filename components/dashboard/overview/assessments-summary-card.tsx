import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERFORMANCE_LABELS } from "@/lib/assessment/constants";
import type { getAssessmentDashboardSummary } from "@/lib/data/assessment";

type Summary = Awaited<ReturnType<typeof getAssessmentDashboardSummary>>;

/** Real assessment data only — kept outside the sample-data section of the overview. */
export function AssessmentsSummaryCard({ summary }: { summary: Summary }) {
  return (
    <Card data-testid="assessments-summary">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-brand" aria-hidden /> Assessments
            </CardTitle>
            <CardDescription>Your real assessment results.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="h-9 sm:h-8">
            <Link href={summary ? "/dashboard/assessments/history" : "/dashboard/assessments"}>
              {summary ? "View history" : "Take an assessment"}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <p className="text-sm text-muted-foreground">
            No assessments yet. Take one to see what you know and what to practice next.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Latest score</dt>
              <dd className="mt-0.5">
                <Link
                  href={`/dashboard/assessments/${summary.latest.id}/results`}
                  className="rounded-sm hover:underline"
                >
                  <span className="text-xl font-semibold tabular-nums">
                    {summary.latest.percentage}%
                  </span>
                </Link>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {PERFORMANCE_LABELS[summary.latest.level]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Assessments completed</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary.completed}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Skills tested</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary.skillsTested}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Weakest skill (latest result)</dt>
              <dd className="mt-0.5 truncate font-medium">
                {summary.weakest
                  ? `${summary.weakest.skill} — ${summary.weakest.percentage}%`
                  : "—"}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
