import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Stage = { key: string; label: string; detail?: string };

type StageListProps = {
  stages: readonly Stage[];
  current: string;
  /** Shown next to the current stage, e.g. a real upload percentage or "Queued". */
  currentNote?: string;
  className?: string;
};

/**
 * Stage-based progress. Callers must map stages to real pipeline checkpoints;
 * nothing here advances on a timer or shows invented percentages.
 */
export function StageList({ stages, current, currentNote, className }: StageListProps) {
  const currentIndex = stages.findIndex((s) => s.key === current);

  return (
    <ol className={cn("grid gap-3", className)} aria-label="Analysis progress">
      {stages.map((stage, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "todo";
        return (
          <li
            key={stage.key}
            className="flex items-start gap-3"
            aria-current={state === "active" ? "step" : undefined}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
                state === "done" && "border-success/40 bg-success/10 text-success",
                state === "active" && "border-brand/50 bg-brand/10 text-brand",
                state === "todo" && "text-muted-foreground/50",
              )}
            >
              {state === "done" && <Check className="size-3.5" aria-hidden />}
              {state === "active" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {state === "todo" && <Circle className="size-2" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm",
                  state === "todo" ? "text-muted-foreground" : "font-medium",
                )}
              >
                {stage.label}
                {state === "active" && currentNote && (
                  <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                    {currentNote}
                  </span>
                )}
                <span className="sr-only">
                  {state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}
                </span>
              </p>
              {stage.detail && state === "active" && (
                <p className="mt-0.5 text-xs text-muted-foreground">{stage.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
