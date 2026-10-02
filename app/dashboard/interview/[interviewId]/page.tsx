import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Target } from "lucide-react";
import {
  DeleteInterviewButton,
  PracticeAgainButton,
} from "@/components/interview/interview-actions";
import { interviewLabel } from "@/components/interview/interview-history";
import { InterviewGenerationProgress } from "@/components/interview/interview-progress";
import { InterviewReport } from "@/components/interview/interview-report";
import { InterviewRunner } from "@/components/interview/interview-runner";
import { InterviewStatusBadge } from "@/components/interview/interview-status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { getMyInterview } from "@/lib/data/interview";
import { formatDate } from "@/lib/format";
import { DIFFICULTY_LABELS, FOCUS_LABELS, INTERVIEW_TYPE_LABELS } from "@/lib/interview/constants";
import { interviewErrorMessage } from "@/lib/interview/errors";

export const metadata: Metadata = { title: "AI Interview" };

export default async function InterviewDetailPage({
  params,
}: PageProps<"/dashboard/interview/[interviewId]">) {
  const { interviewId } = await params;

  // Ownership is part of the query: another user's interview looks exactly like a missing one.
  const interview = await getMyInterview(interviewId);
  if (!interview) notFound();

  const generating = interview.status === "DRAFT" || interview.status === "GENERATING";
  const label = interviewLabel(interview);
  const Icon = interview.sourceType === "JOB_MATCH" ? Briefcase : Target;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/interview"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All interviews
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <Icon className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
              {interview.sourceType === "JOB_MATCH"
                ? `Interview for ${interview.target}`
                : `Career Goal Interview: ${interview.target}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {interview.sourceType === "JOB_MATCH"
                ? `Job Match interview${interview.job?.company ? ` · ${interview.job.company}` : ""}`
                : "Career Goal Interview · not tied to a specific job"}
              {" · "}Created {formatDate(interview.createdAt)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {INTERVIEW_TYPE_LABELS[interview.type]} · {DIFFICULTY_LABELS[interview.difficulty]} ·{" "}
              {interview.questionCount} questions · Focus: {FOCUS_LABELS[interview.focus]}
              {interview.cv && ` · CV: ${interview.cv.fileName}`}
            </p>
            <div className="mt-2">
              <InterviewStatusBadge status={interview.status} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!generating && (
            <PracticeAgainButton interviewId={interview.id} label={label} className="h-10 md:h-9" />
          )}
          <DeleteInterviewButton
            interviewId={interview.id}
            label={label}
            redirectTo="/dashboard/interview"
            className="h-10 md:h-9"
          />
        </div>
      </div>

      {generating ? (
        <InterviewGenerationProgress
          interviewId={interview.id}
          initialStage={interview.stage}
          queued={interview.status === "DRAFT"}
        />
      ) : interview.status === "FAILED" ? (
        <ErrorState
          title="This interview couldn't be prepared"
          description={`${interviewErrorMessage(interview.errorCode)} Use “Practice again” to try once more.`}
        />
      ) : interview.status === "IN_PROGRESS" ? (
        <InterviewRunner interview={interview} />
      ) : interview.report ? (
        <InterviewReport interview={interview} report={interview.report} />
      ) : (
        <ErrorState
          title="This report can't be displayed"
          description="The stored report is unreadable. Practice again to get a fresh interview."
        />
      )}

      {interview.practiceOfId && (
        <p className="text-xs text-muted-foreground">
          A new practice of an earlier interview, which is kept in{" "}
          <Link href="/dashboard/interview" className="text-brand hover:underline">
            your interviews
          </Link>
          .
        </p>
      )}
    </div>
  );
}
