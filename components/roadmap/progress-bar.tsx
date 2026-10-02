import { formatPercent, type Progress } from "@/lib/roadmap/progress";
import { cn } from "@/lib/utils";

/** Deterministic progress: completed tasks ÷ total tasks. */
export function ProgressBar({
  progress,
  label,
  className,
}: {
  progress: Progress;
  label: string;
  className?: string;
}) {
  const percent = formatPercent(progress.percent);
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground" data-testid="progress-percent">
            {percent} complete
          </span>
        </span>
        <span className="tabular-nums">
          {progress.completed} of {progress.total} tasks completed
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${percent} complete, ${progress.completed} of ${progress.total} tasks`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full bg-brand transition-[width]")}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
