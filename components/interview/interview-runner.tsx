"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  CircleDot,
  Circle,
  Flag,
  Loader2,
  Quote,
  SkipForward,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  completeInterviewAction,
  retryEvaluationAction,
  skipQuestionAction,
  submitAnswerAction,
} from "@/app/dashboard/interview/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { AnswerFeedback } from "@/components/interview/answer-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { MyInterview, MyInterviewQuestion } from "@/lib/data/interview";
import {
  ANSWER_MAX,
  QUESTION_KIND_LABELS,
  QUESTION_SOURCE_LABELS,
} from "@/lib/interview/constants";
import { currentQuestion, finishBlocker } from "@/lib/interview/progress";
import { cn } from "@/lib/utils";

function heading(q: MyInterviewQuestion, total: number) {
  return q.followUpIndex === 0
    ? `Question ${q.position} of ${total}`
    : `Follow-up ${q.followUpIndex} · Question ${q.position} of ${total}`;
}

function statusText(q: MyInterviewQuestion, isCurrent: boolean) {
  if (q.status === "SKIPPED") return "Skipped";
  if (q.status === "ANSWERED") {
    if (q.answer?.status === "FAILED") return "Feedback failed";
    if (q.answer?.status === "EVALUATING") return "Evaluating";
    return "Answered";
  }
  return isCurrent ? "Current" : "Not started";
}

function ProgressSummary({ interview, className }: { interview: MyInterview; className?: string }) {
  const { resolved, total, percent } = interview.progress;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums" data-testid="interview-progress">
          {resolved} / {total}
        </span>
        <span className="text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Interview progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${resolved} of ${total} questions answered or skipped`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function InterviewRunner({ interview }: { interview: MyInterview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const current = currentQuestion(interview.questions);
  const shown = interview.questions.find((q) => q.id === viewingId) ?? current;
  const total = interview.questionCount;
  const canFinish = finishBlocker(interview.questions) === null;

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  function submit(q: MyInterviewQuestion) {
    setAnalyzing(true);
    run(async () => {
      const result = await submitAnswerAction({ questionId: q.id, answer: draft });
      setAnalyzing(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      setViewingId(q.id);
      if (!result.evaluated && result.error) setError(result.error);
      router.refresh();
    });
  }

  function skip(q: MyInterviewQuestion) {
    run(async () => {
      const result = await skipQuestionAction({ questionId: q.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      setViewingId(null);
      router.refresh();
    });
  }

  function retry(q: MyInterviewQuestion) {
    setAnalyzing(true);
    run(async () => {
      const result = await retryEvaluationAction({ questionId: q.id });
      setAnalyzing(false);
      if (!result.ok) setError(result.error);
      else if (!result.evaluated && result.error) setError(result.error);
      router.refresh();
    });
  }

  function finish() {
    run(async () => {
      const result = await completeInterviewAction(interview.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside
        aria-labelledby="interview-nav-heading"
        className="hidden min-w-0 lg:sticky lg:top-24 lg:block"
      >
        <Card>
          <CardContent className="grid gap-4">
            <h2 id="interview-nav-heading" className="text-sm font-medium">
              Interview progress
            </h2>
            <ProgressSummary interview={interview} />
            <nav aria-label="Questions">
              <ol className="grid gap-1">
                {interview.questions.map((q) => {
                  const isCurrent = q.id === current?.id;
                  const viewable = q.status !== "PENDING" || isCurrent;
                  const active = q.id === shown?.id;
                  const Icon =
                    q.status === "ANSWERED"
                      ? CircleCheck
                      : q.status === "SKIPPED"
                        ? SkipForward
                        : isCurrent
                          ? CircleDot
                          : Circle;
                  return (
                    <li key={q.id} className={cn(q.followUpIndex > 0 && "pl-5")}>
                      <button
                        type="button"
                        disabled={!viewable}
                        aria-current={active ? "step" : undefined}
                        onClick={() => setViewingId(isCurrent ? null : q.id)}
                        className={cn(
                          "flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-60",
                          active ? "bg-muted font-medium" : viewable && "hover:bg-muted/60",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            q.status === "ANSWERED"
                              ? "text-success"
                              : isCurrent
                                ? "text-brand"
                                : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {q.followUpIndex === 0
                            ? `Question ${q.position}`
                            : `Follow-up ${q.followUpIndex}`}
                        </span>
                        <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                          {statusText(q, isCurrent)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </CardContent>
        </Card>
      </aside>

      <div className="grid min-w-0 gap-6">
        {/* Mobile: navigation collapses into a compact progress indicator. */}
        <ProgressSummary
          interview={interview}
          className="rounded-xl border bg-card p-4 lg:hidden"
        />

        {interview.introduction && interview.progress.resolved === 0 && !viewingId && (
          <Card>
            <CardContent>
              <h2 className="text-sm font-medium">Introduction</h2>
              <p className="mt-1 text-sm text-muted-foreground">{interview.introduction}</p>
            </CardContent>
          </Card>
        )}

        {error && <FormAlert>{error}</FormAlert>}

        {shown ? (
          <Card>
            <CardContent className="grid gap-5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {heading(shown, total)}
                </p>
                <h2
                  className="mt-2 text-lg font-semibold break-words whitespace-pre-wrap"
                  data-testid="question-prompt"
                  data-question-id={shown.id}
                >
                  {shown.prompt}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-normal">
                    {QUESTION_KIND_LABELS[shown.kind]}
                  </Badge>
                  {shown.skill && (
                    <Badge
                      variant="outline"
                      className="max-w-full font-normal break-words whitespace-normal"
                    >
                      {shown.skill}
                    </Badge>
                  )}
                </div>
              </div>

              <div
                className="rounded-lg border bg-muted/30 px-3.5 py-3 text-sm"
                data-testid="question-source"
              >
                <p>
                  <span className="text-muted-foreground">Source: </span>
                  <span className="font-medium">{QUESTION_SOURCE_LABELS[shown.source]}</span>
                </p>
                <p className="mt-0.5">
                  <span className="text-muted-foreground">Reason: </span>
                  {shown.sourceReason}
                </p>
                {shown.sourceEvidence && (
                  <p className="mt-1.5 flex gap-1.5 text-xs text-muted-foreground">
                    <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{shown.sourceEvidence}</span>
                  </p>
                )}
              </div>

              {shown.status === "PENDING" ? (
                analyzing && pending ? (
                  <div
                    className="flex items-start gap-3 rounded-lg border p-4"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2
                      className="mt-0.5 size-5 shrink-0 animate-spin text-brand"
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium">Analyzing your answer…</p>
                      <p className="text-sm text-muted-foreground">
                        Reviewing your answer and generating feedback in one AI pass.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form
                    noValidate
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit(shown);
                    }}
                  >
                    <label htmlFor="answer" className="text-sm font-medium">
                      Your answer
                    </label>
                    <Textarea
                      id="answer"
                      rows={8}
                      value={draft}
                      maxLength={ANSWER_MAX}
                      onChange={(e) => setDraft(e.target.value)}
                      className="max-h-[60vh] min-h-40"
                      placeholder="Answer as you would in a real interview. Specific examples from your own experience help."
                      aria-describedby="answer-hint"
                    />
                    <p id="answer-hint" className="text-xs text-muted-foreground tabular-nums">
                      {draft.length.toLocaleString("en")} / {ANSWER_MAX.toLocaleString("en")}{" "}
                      characters · your answer is private
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 md:h-9"
                        disabled={pending}
                        onClick={() => skip(shown)}
                      >
                        <SkipForward /> Skip question
                      </Button>
                      <Button
                        type="submit"
                        className="h-10 md:h-9"
                        disabled={pending || draft.trim().length === 0}
                      >
                        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        Submit answer
                      </Button>
                    </div>
                  </form>
                )
              ) : shown.status === "SKIPPED" ? (
                <p className="text-sm text-muted-foreground">You skipped this question.</p>
              ) : (
                <div className="grid gap-5">
                  <div>
                    <h3 className="text-sm font-medium">Your answer</h3>
                    <p
                      className="mt-1 text-sm break-words whitespace-pre-wrap text-muted-foreground"
                      data-testid="your-answer"
                    >
                      {shown.answer?.content}
                    </p>
                  </div>
                  <div className="border-t pt-5">
                    <h3 className="sr-only">Answer feedback</h3>
                    {shown.answer?.status === "EVALUATED" ? (
                      <AnswerFeedback answer={shown.answer} headingLevel={4} />
                    ) : shown.answer?.status === "FAILED" ? (
                      <div className="grid gap-3">
                        <p className="text-sm">
                          Your answer is saved, but feedback couldn&apos;t be generated.
                        </p>
                        <Button
                          variant="outline"
                          className="h-10 w-fit md:h-9"
                          disabled={pending}
                          onClick={() => retry(shown)}
                        >
                          {pending ? <Loader2 className="animate-spin" /> : null}
                          Retry feedback
                        </Button>
                      </div>
                    ) : (
                      <p
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                        role="status"
                      >
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Analyzing your
                        answer…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {shown.status !== "PENDING" && (
                <div className="flex justify-end border-t pt-4">
                  {current ? (
                    <Button
                      className="h-10 md:h-9"
                      onClick={() => {
                        setError(null);
                        setViewingId(null);
                      }}
                    >
                      Continue <ArrowRight />
                    </Button>
                  ) : canFinish ? (
                    <Button className="h-10 md:h-9" disabled={pending} onClick={finish}>
                      {pending ? <Loader2 className="animate-spin" /> : <Flag />}
                      Finish interview
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid gap-3">
              <h2 className="text-lg font-semibold">All questions answered</h2>
              <p className="text-sm text-muted-foreground">
                {canFinish
                  ? "Finish the interview to see your overall score, category scores and practice plan."
                  : "Some answers still need feedback. Open them and retry."}
              </p>
              {!canFinish && (
                <ul className="flex flex-wrap gap-2">
                  {interview.questions
                    .filter((q) => q.status === "ANSWERED" && q.answer?.status !== "EVALUATED")
                    .map((q) => (
                      <li key={q.id}>
                        <Button
                          variant="outline"
                          className="h-10 md:h-9"
                          onClick={() => setViewingId(q.id)}
                        >
                          Open{" "}
                          {q.followUpIndex === 0
                            ? `question ${q.position}`
                            : `follow-up ${q.followUpIndex} to question ${q.position}`}
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
              {canFinish && (
                <Button className="h-10 w-fit md:h-9" disabled={pending} onClick={finish}>
                  {pending ? <Loader2 className="animate-spin" /> : <Flag />}
                  Finish interview
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
