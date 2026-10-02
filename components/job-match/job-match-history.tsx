import Link from "next/link";
import { Briefcase } from "lucide-react";
import { AnalysisStatusBadge, isActiveStatus } from "@/components/cv/analysis-status-badge";
import { DeleteJobMatchButton, ReanalyzeJobButton } from "@/components/job-match/job-match-actions";
import { Button } from "@/components/ui/button";
import type { MyJobMatchListItem } from "@/lib/data/job-match";
import { formatDateTime } from "@/lib/format";
import { jobMatchLabel } from "@/lib/job-match/display";

/** Saved matches with their latest run: open, re-run or delete each one. */
export function JobMatchHistory({ matches }: { matches: MyJobMatchListItem[] }) {
  return (
    // grid-cols-1 is minmax(0, 1fr): lets long titles truncate instead of widening the page.
    <ul className="grid grid-cols-1 gap-3">
      {matches.map((match) => {
        const latest = match.analyses[0];
        const label = jobMatchLabel(match);
        const href = `/dashboard/job-match/${match.id}${latest ? `?analysis=${latest.id}` : ""}`;
        return (
          <li key={match.id} className="min-w-0 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
                <Briefcase className="size-4 text-brand" />
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
                  CV: {latest?.cv?.fileName ?? "deleted"} ·{" "}
                  {formatDateTime(latest?.createdAt ?? match.createdAt)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <AnalysisStatusBadge status={latest?.status} />
                  {latest?.provider === "mock" && latest.status === "COMPLETED" && (
                    <span className="text-[11px] text-muted-foreground">Mock</span>
                  )}
                  {match._count.analyses > 1 && (
                    <span className="text-[11px] text-muted-foreground">
                      {match._count.analyses} runs
                    </span>
                  )}
                </div>
              </div>
              {latest?.status === "COMPLETED" && latest.matchScore !== null && (
                <div className="text-right">
                  <p className="text-2xl leading-none font-semibold tabular-nums">
                    {latest.matchScore}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">/ 100</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href={href} aria-label={`Open ${label}`}>
                  {isActiveStatus(latest?.status) ? "View progress" : "Open"}
                </Link>
              </Button>
              {!isActiveStatus(latest?.status) && latest?.cv && (
                <ReanalyzeJobButton
                  jobId={match.id}
                  jobLabel={label}
                  size="sm"
                  className="h-9 sm:h-8"
                />
              )}
              <DeleteJobMatchButton
                jobId={match.id}
                jobLabel={label}
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
