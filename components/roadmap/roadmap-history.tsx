import Link from "next/link";
import { Briefcase, Target } from "lucide-react";
import { AnalysisStatusBadge, isActiveStatus } from "@/components/cv/analysis-status-badge";
import { DeleteRoadmapButton, RegenerateRoadmapButton } from "@/components/roadmap/roadmap-actions";
import { ProgressBar } from "@/components/roadmap/progress-bar";
import { Button } from "@/components/ui/button";
import type { MyRoadmapListItem } from "@/lib/data/roadmap";
import { formatDateTime } from "@/lib/format";

/** Saved roadmaps: open, re-generate or delete each one. */
export function RoadmapHistory({ roadmaps }: { roadmaps: MyRoadmapListItem[] }) {
  return (
    // grid-cols-1 is minmax(0, 1fr): lets long titles truncate instead of widening the page.
    <ul className="grid grid-cols-1 gap-3">
      {roadmaps.map((roadmap) => {
        const href = `/dashboard/roadmap/${roadmap.id}`;
        const Icon = roadmap.sourceType === "JOB_MATCH" ? Briefcase : Target;
        return (
          <li key={roadmap.id} className="min-w-0 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
                <Icon className="size-4 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={href}
                  className="-my-1 block truncate rounded-sm py-1 text-sm font-medium hover:underline"
                  title={roadmap.title}
                >
                  {roadmap.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {roadmap.sourceType === "JOB_MATCH" ? "From Job Match" : "Career-goal roadmap"} ·{" "}
                  {formatDateTime(roadmap.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AnalysisStatusBadge status={roadmap.status} />
                  {roadmap.provider === "mock" && roadmap.status === "COMPLETED" && (
                    <span className="text-[11px] text-muted-foreground">Mock</span>
                  )}
                  {roadmap.regeneratedFromId && (
                    <span className="text-[11px] text-muted-foreground">Re-generated</span>
                  )}
                </div>
                {roadmap.status === "COMPLETED" && roadmap.progress.total > 0 && (
                  <ProgressBar progress={roadmap.progress} label={roadmap.title} className="mt-3" />
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href={href} aria-label={`Open ${roadmap.title}`}>
                  {isActiveStatus(roadmap.status) ? "View progress" : "Open"}
                </Link>
              </Button>
              {!isActiveStatus(roadmap.status) && (
                <RegenerateRoadmapButton
                  roadmapId={roadmap.id}
                  label={roadmap.title}
                  size="sm"
                  className="h-9 sm:h-8"
                />
              )}
              <DeleteRoadmapButton
                roadmapId={roadmap.id}
                label={roadmap.title}
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
