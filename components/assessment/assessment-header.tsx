import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import {
  DeleteAssessmentButton,
  PracticeAgainButton,
} from "@/components/assessment/assessment-actions";
import { AssessmentStatusBadge } from "@/components/assessment/assessment-status-badge";
import { formatDate } from "@/lib/format";
import {
  DIFFICULTY_LABELS,
  FOCUS_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  type AssessmentSource,
  type AssessmentStatus,
  type AssessmentType,
  type Difficulty,
  type Focus,
} from "@/lib/assessment/constants";

export function AssessmentHeader({
  a,
  showPracticeAgain,
}: {
  a: {
    id: string;
    title: string;
    sourceType: AssessmentSource;
    skills: string[];
    type: AssessmentType;
    difficulty: Difficulty;
    focus: Focus;
    questionCount: number;
    status: AssessmentStatus;
    job: { title: string | null; company: string | null } | null;
    createdAt?: Date;
    completedAt?: Date | null;
  };
  showPracticeAgain: boolean;
}) {
  return (
    <>
      <Link
        href="/dashboard/assessments"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All assessments
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <ClipboardCheck className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
              {a.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {SOURCE_LABELS[a.sourceType]} assessment
              {a.job?.company ? ` · ${a.job.company}` : ""}
              {a.completedAt
                ? ` · Completed ${formatDate(a.completedAt)}`
                : a.createdAt
                  ? ` · Created ${formatDate(a.createdAt)}`
                  : ""}
            </p>
            <p className="mt-1 text-sm break-words text-muted-foreground">
              Skills: {a.skills.join(", ")} · {TYPE_LABELS[a.type]} ·{" "}
              {DIFFICULTY_LABELS[a.difficulty]} · {a.questionCount} questions · Focus:{" "}
              {FOCUS_LABELS[a.focus]}
            </p>
            <div className="mt-2">
              <AssessmentStatusBadge status={a.status} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showPracticeAgain && (
            <PracticeAgainButton assessmentId={a.id} label={a.title} className="h-10 md:h-9" />
          )}
          <DeleteAssessmentButton
            assessmentId={a.id}
            label={a.title}
            redirectTo="/dashboard/assessments"
            className="h-10 md:h-9"
          />
        </div>
      </div>
    </>
  );
}
