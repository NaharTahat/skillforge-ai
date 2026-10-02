import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, ExternalLink, FileText } from "lucide-react";
import { AnalysisHistoryList } from "@/components/cv/analysis-history";
import { isActiveStatus } from "@/components/cv/analysis-status-badge";
import { DeleteJobMatchButton, ReanalyzeJobButton } from "@/components/job-match/job-match-actions";
import { JobMatchProgress } from "@/components/job-match/job-match-progress";
import { JobMatchReport } from "@/components/job-match/report/job-match-report";
import { ErrorState } from "@/components/shared/error-state";
import { getMyJobMatch, getMyJobMatchReport } from "@/lib/data/job-match";
import { formatDate } from "@/lib/format";
import { jobMatchLabel } from "@/lib/job-match/display";
import { jobMatchErrorMessage } from "@/lib/job-match/errors";

export const metadata: Metadata = { title: "Job match" };

export default async function JobMatchDetailPage({
  params,
  searchParams,
}: PageProps<"/dashboard/job-match/[matchId]">) {
  const { matchId } = await params;
  const { analysis: requested } = await searchParams;

  // Ownership is part of the query: another user's match looks exactly like a missing one.
  const job = await getMyJobMatch(matchId);
  if (!job) notFound();

  const selected =
    (typeof requested === "string" && job.analyses.find((a) => a.id === requested)) ||
    job.analyses[0];
  const running = job.analyses.some((a) => isActiveStatus(a.status));
  const latestCv = job.analyses[0]?.cv ?? null;
  const label = jobMatchLabel(job);
  const report =
    selected?.status === "COMPLETED" ? await getMyJobMatchReport(job.id, selected.id) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/job-match"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All job matches
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <Briefcase className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
              {job.title ?? "Untitled job"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[job.company, job.location].filter(Boolean).join(" · ") || "Company not specified"}
              {" · "}Created {formatDate(job.createdAt)}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">CV: {latestCv?.fileName ?? "deleted"}</span>
              </span>
              {job.sourceUrl && (
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="-my-1 inline-flex items-center gap-1 rounded-sm py-1 text-brand hover:underline"
                >
                  View posting <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!running && latestCv && (
            <ReanalyzeJobButton jobId={job.id} jobLabel={label} className="h-10 md:h-9" />
          )}
          <DeleteJobMatchButton
            jobId={job.id}
            jobLabel={label}
            redirectTo="/dashboard/job-match"
            className="h-10 md:h-9"
          />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {!selected ? (
            <ErrorState
              title="No analysis found"
              description={jobMatchErrorMessage("MATCH_NOT_FOUND")}
            />
          ) : isActiveStatus(selected.status) ? (
            <JobMatchProgress analysisId={selected.id} initialStage={selected.stage} />
          ) : selected.status === "FAILED" ? (
            <ErrorState
              title="This match didn't complete"
              description={jobMatchErrorMessage(selected.errorCode)}
            />
          ) : report ? (
            <JobMatchReport report={report.report} provider={report.provider} />
          ) : (
            <ErrorState
              title="This report can't be displayed"
              description="The stored report is unreadable. Re-run the match to get a fresh report."
            />
          )}

          <details className="rounded-xl border bg-card px-5 py-4">
            <summary className="cursor-pointer text-sm font-medium">Job description</summary>
            <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground">
              {job.description}
            </p>
          </details>
        </div>

        <aside aria-labelledby="runs-heading" className="min-w-0 lg:sticky lg:top-24">
          <h2 id="runs-heading" className="mb-3 text-sm font-medium">
            Match history
          </h2>
          <AnalysisHistoryList
            selectedId={selected?.id}
            hrefFor={(entry) => `/dashboard/job-match/${job.id}?analysis=${entry.id}`}
            entries={job.analyses.map((a) => ({
              id: a.id,
              cvId: a.cv?.id ?? "",
              fileName: a.cv?.fileName ?? "Deleted CV",
              status: a.status,
              score: a.matchScore,
              provider: a.provider,
              createdAt: a.createdAt,
            }))}
            showFileName
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Re-analyzing creates a new entry; earlier reports are kept.
          </p>
        </aside>
      </div>
    </div>
  );
}
