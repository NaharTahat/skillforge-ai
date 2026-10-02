"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, Flag, Loader2, Lock, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  saveAnswerAction,
  startAssessmentAction,
  submitAssessmentAction,
} from "@/app/dashboard/assessments/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { MyAssessment, MyAssessmentQuestion } from "@/lib/data/assessment";
import {
  DIFFICULTY_LABELS,
  FOCUS_LABELS,
  LEVEL_LABELS,
  QUESTION_SOURCE_LABELS,
  QUESTION_TYPE_LABELS,
  TEXT_ANSWER_MAX,
  TYPE_LABELS,
} from "@/lib/assessment/constants";
import { cn } from "@/lib/utils";

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function responseLabel(q: MyAssessmentQuestion, response: string) {
  if (q.type === "TRUE_FALSE") return response === "true" ? "True" : "False";
  if (q.type === "MULTIPLE_CHOICE")
    return q.options?.find((o) => o.id === response)?.label ?? response;
  return response;
}

/** Start screen: nothing is timed until the user presses Start. */
export function AssessmentStart({ assessment }: { assessment: MyAssessment }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Ready to start
        </CardTitle>
        <CardDescription>
          Your questions are ready. Read the rules, then start when you are.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Questions</dt>
            <dd className="font-medium">{assessment.questionCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Time limit</dt>
            <dd className="font-medium">
              {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutes` : "No limit"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Type</dt>
            <dd className="font-medium">{TYPE_LABELS[assessment.type]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Difficulty</dt>
            <dd className="font-medium">{DIFFICULTY_LABELS[assessment.difficulty]}</dd>
          </div>
        </dl>
        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          <li>• Each answer is locked once you save it.</li>
          <li>• You can move between questions and answer them in any order.</li>
          {assessment.timeLimitMinutes && (
            <li>• The timer starts now and keeps running if you leave the page.</li>
          )}
          <li>• Code answers are read and evaluated as text — they are never executed.</li>
          <li>• Your score is calculated by SkillForge from your answers.</li>
        </ul>
        <Button
          className="h-10 w-fit md:h-9"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await startAssessmentAction(assessment.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              } catch {
                setError("Something went wrong. Please try again.");
              }
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Play />}
          Start assessment
        </Button>
      </CardContent>
    </Card>
  );
}

/** Shown when the time limit has passed: saved answers are scored on request. */
export function AssessmentTimeUp({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Time&apos;s up
        </CardTitle>
        <CardDescription>
          The time limit has passed. Answers you saved in time will be scored.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          className="h-10 w-fit md:h-9"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await submitAssessmentAction(assessmentId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.push(`/dashboard/assessments/${assessmentId}/results`);
              } catch {
                setError("Something went wrong. Please try again.");
              }
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Flag />}
          {pending ? "Scoring your assessment…" : "View results"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AssessmentRunner({ assessment }: { assessment: MyAssessment }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const questions = assessment.questions;
  const firstOpen = Math.max(
    0,
    questions.findIndex((q) => q.status === "PENDING"),
  );
  const [index, setIndex] = useState(firstOpen);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Server-anchored countdown: starts from the server's clock; the browser-clock offset is measured in the effect.
  const serverNowMs = new Date(assessment.serverNow).getTime();
  const deadline = assessment.expiresAt ? new Date(assessment.expiresAt).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(
    deadline !== null ? deadline - serverNowMs : null,
  );
  const [announce, setAnnounce] = useState("");

  const q = questions[index]!;
  const unanswered = questions.filter((x) => x.status === "PENDING").length;

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitAssessmentAction(assessment.id);
        if (!result.ok) {
          submittedRef.current = false;
          setSubmitting(false);
          setError(result.error);
          return;
        }
        router.push(`/dashboard/assessments/${assessment.id}/results`);
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
        setError("Something went wrong. Please try again.");
      }
    });
  }, [assessment.id, router]);

  useEffect(() => {
    if (deadline === null) return;
    const offset = serverNowMs - Date.now();
    const tick = () => {
      const left = deadline - (Date.now() + offset);
      setRemaining(left);
      const minutes = Math.ceil(left / 60_000);
      if (minutes === 5 || minutes === 1)
        setAnnounce(`${minutes} minute${minutes === 1 ? "" : "s"} remaining`);
      if (left <= 0) submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, serverNowMs, submit]);

  function save() {
    const response = drafts[q.id] ?? "";
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveAnswerAction({ questionId: q.id, response });
        if (!result.ok) {
          setError(result.error);
          if (/expired/i.test(result.error)) router.refresh();
          return;
        }
        // Move to the next unanswered question, if any.
        const next = questions.findIndex((x, i) => i > index && x.status === "PENDING");
        if (next !== -1) setIndex(next);
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const draft = drafts[q.id] ?? "";
  const promptId = `q-${q.id}-prompt`;

  return (
    <div className="grid min-w-0 gap-6">
      <Card>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium tabular-nums" data-testid="assessment-progress">
                  {assessment.progress.answered} / {assessment.progress.total} answered
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {assessment.progress.percent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Assessment progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={assessment.progress.percent}
                aria-valuetext={`${assessment.progress.answered} of ${assessment.progress.total} questions answered`}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${assessment.progress.percent}%` }}
                />
              </div>
            </div>
            {remaining !== null && (
              <p
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums",
                  remaining < 60_000
                    ? "border-destructive/40 text-destructive"
                    : remaining < 300_000 && "border-warning/50 text-warning",
                )}
              >
                <Clock className="size-4" aria-hidden />
                <span
                  role="timer"
                  aria-label={`Time left ${formatClock(remaining)}`}
                  data-testid="assessment-timer"
                >
                  {formatClock(remaining)}
                </span>
              </p>
            )}
            <span className="sr-only" aria-live="polite">
              {announce}
            </span>
          </div>
          <nav aria-label="Questions">
            <ol className="flex flex-wrap gap-1.5">
              {questions.map((x, i) => (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Question ${i + 1}, ${x.status === "ANSWERED" ? "answered" : "not answered"}`}
                    className={cn(
                      "grid size-9 place-items-center rounded-md border text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      x.status === "ANSWERED" && "border-success/40 bg-success/10",
                      i === index && "border-brand bg-brand/10 font-semibold",
                    )}
                  >
                    {x.status === "ANSWERED" ? (
                      <Check className="size-3.5 text-success" aria-hidden />
                    ) : (
                      i + 1
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </CardContent>
      </Card>

      {error && <FormAlert>{error}</FormAlert>}

      <Card>
        <CardContent className="grid gap-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Question {index + 1} of {questions.length}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {q.skill}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {LEVEL_LABELS[q.difficulty]}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {QUESTION_TYPE_LABELS[q.type]}
              </Badge>
            </div>
          </div>
          <p
            className="rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs"
            data-testid="question-source"
          >
            <span className="text-muted-foreground">Why this question: </span>
            <span className="font-medium">{QUESTION_SOURCE_LABELS[q.source]}</span> —{" "}
            {q.sourceReason}
          </p>
          {q.scenario && (
            <div className="rounded-lg border-l-4 border-brand/50 bg-brand/5 px-4 py-3 text-sm whitespace-pre-wrap">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Scenario</p>
              {q.scenario}
            </div>
          )}
          <h2
            id={promptId}
            className="text-lg font-semibold break-words whitespace-pre-wrap"
            data-testid="question-prompt"
            data-question-id={q.id}
          >
            {q.prompt}
          </h2>

          {q.status === "ANSWERED" ? (
            <div className="grid gap-1.5 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <Lock className="size-3.5" aria-hidden /> Answer saved — locked
              </p>
              <p
                className="break-words whitespace-pre-wrap text-muted-foreground"
                data-testid="saved-answer"
              >
                {responseLabel(q, q.answer?.response ?? "")}
              </p>
            </div>
          ) : q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE" ? (
            <fieldset aria-labelledby={promptId} className="grid gap-2">
              {(q.type === "TRUE_FALSE"
                ? [
                    { id: "true", label: "True" },
                    { id: "false", label: "False" },
                  ]
                : (q.options ?? [])
              ).map((o) => {
                const checked = draft === o.id;
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
                      checked ? "border-brand bg-brand/5 font-medium" : "hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name={`answer-${q.id}`}
                      value={o.id}
                      checked={checked}
                      onChange={() => setDrafts({ ...drafts, [q.id]: o.id })}
                      className="size-4 shrink-0 accent-brand"
                    />
                    <span className="min-w-0 break-words">{o.label}</span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="grid gap-2">
              <label htmlFor={`answer-${q.id}`} className="text-sm font-medium">
                Your answer
              </label>
              <Textarea
                id={`answer-${q.id}`}
                rows={q.type === "TECHNICAL" ? 10 : 6}
                value={draft}
                maxLength={TEXT_ANSWER_MAX}
                onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                className={cn(
                  "max-h-[60vh] min-h-32",
                  q.type === "TECHNICAL" && "font-mono text-sm",
                )}
                aria-describedby={`answer-${q.id}-hint`}
              />
              <p id={`answer-${q.id}-hint`} className="text-xs text-muted-foreground tabular-nums">
                {draft.length.toLocaleString("en")} / {TEXT_ANSWER_MAX.toLocaleString("en")}{" "}
                characters
                {q.type === "TECHNICAL" && " · code is read as text and never executed"}
              </p>
            </div>
          )}

          {q.status !== "ANSWERED" && (
            <Button
              className="h-10 w-fit md:h-9"
              disabled={pending || draft.trim().length === 0}
              onClick={save}
            >
              {pending && !submitting ? <Loader2 className="animate-spin" /> : <Lock />}
              Save answer
            </Button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 md:h-9"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ArrowLeft /> Previous
              </Button>
              <Button
                variant="outline"
                className="h-10 md:h-9"
                disabled={index === questions.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next <ArrowRight />
              </Button>
            </div>
            {!confirming || unanswered === 0 ? (
              <Button
                className="h-10 md:h-9"
                disabled={pending}
                onClick={() => (unanswered > 0 ? setConfirming(true) : submit())}
              >
                {submitting ? <Loader2 className="animate-spin" /> : <Flag />}
                {submitting ? "Scoring your assessment…" : "Submit assessment"}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2" role="alert">
                <span className="text-sm text-muted-foreground">
                  {unanswered} unanswered question{unanswered === 1 ? "" : "s"} will score 0.
                </span>
                <Button
                  variant="ghost"
                  className="h-10 md:h-9"
                  onClick={() => setConfirming(false)}
                >
                  Keep answering
                </Button>
                <Button className="h-10 md:h-9" disabled={pending} onClick={submit}>
                  {submitting ? <Loader2 className="animate-spin" /> : <Flag />}
                  {submitting ? "Scoring your assessment…" : "Submit anyway"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {TYPE_LABELS[assessment.type]} · Focus: {FOCUS_LABELS[assessment.focus]} ·{" "}
        {DIFFICULTY_LABELS[assessment.difficulty]}
      </p>
    </div>
  );
}
