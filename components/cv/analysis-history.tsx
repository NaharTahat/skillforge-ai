import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AnalysisStatusBadge } from "@/components/cv/analysis-status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HistoryEntry = {
  id: string;
  cvId: string;
  fileName?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  score: number | null;
  provider: string;
  createdAt: Date;
};

/**
 * Chronological list of analysis runs; each row opens that run. Server
 * component, shared by the CV Analyzer and Job Match (via `hrefFor`).
 */
export function AnalysisHistoryList({
  entries,
  selectedId,
  showFileName = false,
  hrefFor = (entry) => `/dashboard/cv/${entry.cvId}?analysis=${entry.id}`,
}: {
  entries: HistoryEntry[];
  selectedId?: string;
  showFileName?: boolean;
  hrefFor?: (entry: HistoryEntry) => string;
}) {
  return (
    <ul className="divide-y rounded-xl border">
      {entries.map((entry) => {
        const selected = entry.id === selectedId;
        return (
          <li key={entry.id}>
            <Link
              href={hrefFor(entry)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                selected && "bg-brand/5",
              )}
            >
              <div className="min-w-0 flex-1">
                {showFileName && (
                  <p className="truncate text-sm font-medium" title={entry.fileName}>
                    {entry.fileName}
                  </p>
                )}
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    !showFileName && "text-sm text-foreground",
                  )}
                >
                  {formatDateTime(entry.createdAt)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <AnalysisStatusBadge status={entry.status} />
                  {entry.provider === "mock" && (
                    <span className="text-[11px] text-muted-foreground">Mock</span>
                  )}
                </div>
              </div>
              {entry.status === "COMPLETED" && entry.score !== null && (
                <span className="text-lg font-semibold tabular-nums">{entry.score}</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
