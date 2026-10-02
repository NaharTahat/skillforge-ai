import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import {
  DeleteAssessmentButton,
  PracticeAgainButton,
} from "@/components/assessment/assessment-actions";
import { AssessmentStatusBadge } from "@/components/assessment/assessment-status-badge";
import { Button } from "@/components/ui/button";
import type { MyAssessmentListItem } from "@/lib/data/assessment";
import { formatDateTime } from "@/lib/format";
import { DIFFICULTY_LABELS, PERFORMANCE_LABELS, SOURCE_LABELS } from "@/lib/assessment/constants";

/** Assessment records: view results, practice again or delete each one. */
export function AssessmentHistory({ assessments }: { assessments: MyAssessmentListItem[] }) {
  return (
    // grid-cols-1 is minmax(0, 1fr): lets long titles truncate instead of widening the page.
    <ul className="grid grid-cols-1 gap-3">
      {assessments.map((a) => {
        const finished = a.status === "COMPLETED" || a.status === "EXPIRED";
        const generating = a.status === "DRAFT" || a.status === "GENERATING";
        const href = finished
          ? `/dashboard/assessments/${a.id}/results`
          : `/dashboard/assessments/${a.id}`;
        return (
          <li
            key={a.id}
            className="min-w-0 rounded-xl border bg-card p-4"
            data-testid="assessment-history-item"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
                <ClipboardCheck className="size-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={href}
                  className="-my-1 block truncate rounded-sm py-1 text-sm font-medium hover:underline"
                  title={a.title}
                >
                  {a.title}
                </Link>
                <dl className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt className="sr-only">Source</dt>
                    <dd>{SOURCE_LABELS[a.sourceType]}</dd>
                  </div>
                  <div className="flex min-w-0 gap-1">
                    <dt>Skills:</dt>
                    <dd className="truncate">{a.skills.join(", ")}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="sr-only">Difficulty</dt>
                    <dd>{DIFFICULTY_LABELS[a.difficulty]}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="sr-only">Questions</dt>
                    <dd>{a.questionCount} questions</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="sr-only">Date</dt>
                    <dd>{formatDateTime(a.createdAt)}</dd>
                  </div>
                </dl>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AssessmentStatusBadge status={a.status} />
                  {a.provider === "mock" && finished && (
                    <span className="text-[11px] text-muted-foreground">Mock</span>
                  )}
                  {a.practiceOfId && (
                    <span className="text-[11px] text-muted-foreground">Practice again</span>
                  )}
                </div>
              </div>
              {finished && a.result && (
                <div className="text-right">
                  <p className="text-2xl leading-none font-semibold tabular-nums">
                    {a.result.percentage}%
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {PERFORMANCE_LABELS[a.result.level]}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href={href} aria-label={`${finished ? "View results" : "Open"}: ${a.title}`}>
                  {finished
                    ? "View results"
                    : generating
                      ? "View progress"
                      : a.status === "FAILED"
                        ? "Open"
                        : "Continue"}
                </Link>
              </Button>
              {!generating && (
                <PracticeAgainButton
                  assessmentId={a.id}
                  label={a.title}
                  size="sm"
                  className="h-9 sm:h-8"
                />
              )}
              <DeleteAssessmentButton
                assessmentId={a.id}
                label={a.title}
                size="sm"
                className="ml-auto h-9 sm:h-8"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
