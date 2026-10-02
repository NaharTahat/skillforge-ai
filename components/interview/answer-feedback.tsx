import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, Lightbulb } from "lucide-react";
import type { MyInterviewQuestion } from "@/lib/data/interview";
import {
  DIMENSIONS,
  DIMENSION_LABELS,
  VERDICT_DESCRIPTIONS,
  VERDICT_LABELS,
  type Verdict,
} from "@/lib/interview/constants";
import { cn } from "@/lib/utils";

const VERDICT_STYLE: Record<Verdict, { icon: typeof CircleCheck; tone: string }> = {
  STRONG: { icon: CircleCheck, tone: "text-success" },
  PARTIAL: { icon: CircleDashed, tone: "text-warning" },
  WEAK_EVIDENCE: { icon: CircleHelp, tone: "text-warning" },
  INCORRECT: { icon: CircleAlert, tone: "text-destructive" },
};

type Answer = NonNullable<MyInterviewQuestion["answer"]>;

/** Evaluated answer feedback. Every score shown here was computed in code. */
export function AnswerFeedback({
  answer,
  headingLevel = 3,
}: {
  answer: Answer;
  headingLevel?: 3 | 4;
}) {
  if (answer.status !== "EVALUATED" || !answer.verdict) return null;
  const style = VERDICT_STYLE[answer.verdict];
  const H = `h${headingLevel}` as "h3" | "h4";
  const dims = DIMENSIONS.filter((d) => answer[d] !== null);

  return (
    <section aria-label="Answer feedback" className="grid gap-4" data-testid="answer-feedback">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <style.icon className={cn("mt-0.5 size-5 shrink-0", style.tone)} aria-hidden />
          <div className="min-w-0">
            <H className="font-medium">{VERDICT_LABELS[answer.verdict]}</H>
            <p className="text-xs text-muted-foreground">{VERDICT_DESCRIPTIONS[answer.verdict]}</p>
          </div>
        </div>
        {answer.score !== null && (
          <p className="text-right text-sm text-muted-foreground">
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {answer.score}
            </span>{" "}
            / 100
          </p>
        )}
      </div>

      {answer.feedback && <p className="text-sm text-muted-foreground">{answer.feedback}</p>}

      <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {dims.map((d) => (
          <li key={d}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span>{DIMENSION_LABELS[d]}</span>
              <span className="text-muted-foreground tabular-nums">{answer[d]}/10</span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${DIMENSION_LABELS[d]}: ${answer[d]} out of 10`}
            >
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${(answer[d] ?? 0) * 10}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {answer.strengths.length > 0 && (
          <div className="min-w-0">
            <H className="text-sm font-medium">Strengths</H>
            <ul className="mt-1.5 grid gap-1 text-sm">
              {answer.strengths.map((s) => (
                <li key={s} className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0 break-words">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {answer.missingPoints.length > 0 && (
          <div className="min-w-0">
            <H className="text-sm font-medium">Missing points</H>
            <ul className="mt-1.5 grid gap-1 text-sm">
              {answer.missingPoints.map((s) => (
                <li key={s} className="flex gap-2">
                  <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span className="min-w-0 break-words">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {answer.accuracyNote && (
        <p className="text-sm">
          <span className="font-medium">Technical accuracy: </span>
          <span className="text-muted-foreground">{answer.accuracyNote}</span>
        </p>
      )}
      {answer.improvement && (
        <p className="flex gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 break-words">
            <span className="font-medium">Improvement suggestion: </span>
            {answer.improvement}
          </span>
        </p>
      )}
    </section>
  );
}
