import Link from "next/link";
import { Briefcase, Target } from "lucide-react";
import {
  DeleteInterviewButton,
  PracticeAgainButton,
} from "@/components/interview/interview-actions";
import { InterviewStatusBadge } from "@/components/interview/interview-status-badge";
import { Button } from "@/components/ui/button";
import type { MyInterviewListItem } from "@/lib/data/interview";
import { formatDateTime } from "@/lib/format";
import { DIFFICULTY_LABELS, INTERVIEW_TYPE_LABELS } from "@/lib/interview/constants";

export function interviewLabel(interview: {
  target: string;
  type: keyof typeof INTERVIEW_TYPE_LABELS;
}) {
  return `${INTERVIEW_TYPE_LABELS[interview.type]} interview: ${interview.target}`;
}

/** Saved interviews: open, practice again or delete each one. */
export function InterviewHistory({ interviews }: { interviews: MyInterviewListItem[] }) {
  return (
    // grid-cols-1 is minmax(0, 1fr): lets long titles truncate instead of widening the page.
    <ul className="grid grid-cols-1 gap-3">
      {interviews.map((interview) => {
        const href = `/dashboard/interview/${interview.id}`;
        const label = interviewLabel(interview);
        const Icon = interview.sourceType === "JOB_MATCH" ? Briefcase : Target;
        const generating = interview.status === "DRAFT" || interview.status === "GENERATING";
        return (
          <li
            key={interview.id}
            className="min-w-0 rounded-xl border bg-card p-4"
            data-testid="interview-history-item"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
                <Icon className="size-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={href}
                  className="-my-1 block truncate rounded-sm py-1 text-sm font-medium hover:underline"
                  title={label}
                >
                  {label}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {interview.sourceType === "JOB_MATCH"
                    ? `Job Match${interview.job?.company ? ` · ${interview.job.company}` : ""}`
                    : "Career Goal Interview"}{" "}
                  · {DIFFICULTY_LABELS[interview.difficulty]} ·{" "}
                  {formatDateTime(interview.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <InterviewStatusBadge status={interview.status} />
                  {interview.provider === "mock" && interview.status === "COMPLETED" && (
                    <span className="text-[11px] text-muted-foreground">Mock</span>
                  )}
                  {interview.practiceOfId && (
                    <span className="text-[11px] text-muted-foreground">Practice again</span>
                  )}
                </div>
              </div>
              {interview.status === "COMPLETED" && interview.overallScore !== null && (
                <div className="text-right">
                  <p className="text-2xl leading-none font-semibold tabular-nums">
                    {interview.overallScore}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">/ 100</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href={href} aria-label={`Open ${label}`}>
                  {generating
                    ? "View progress"
                    : interview.status === "IN_PROGRESS"
                      ? "Continue"
                      : "Open"}
                </Link>
              </Button>
              {!generating && (
                <PracticeAgainButton
                  interviewId={interview.id}
                  label={label}
                  size="sm"
                  className="h-9 sm:h-8"
                />
              )}
              <DeleteInterviewButton
                interviewId={interview.id}
                label={label}
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
