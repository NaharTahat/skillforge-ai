import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { AnalysisHistoryList } from "@/components/cv/analysis-history";
import { AnalysisProgress } from "@/components/cv/analysis-progress";
import { isActiveStatus } from "@/components/cv/analysis-status-badge";
import { AnalyzeCvButton, DeleteCvButton } from "@/components/cv/cv-actions";
import { AnalysisReport } from "@/components/cv/report/analysis-report";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CV_KINDS, cvKindFromMime, formatBytes } from "@/lib/cv/constants";
import { cvErrorMessage } from "@/lib/cv/errors";
import { getMyAnalysisReport, getMyCv } from "@/lib/data/cv";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "CV analysis" };

export default async function CvAnalysisPage({
  params,
  searchParams,
}: PageProps<"/dashboard/cv/[cvId]">) {
  const { cvId } = await params;
  const { analysis: requested } = await searchParams;

  // Ownership is part of the query: another user's CV is indistinguishable from a missing one.
  const cv = await getMyCv(cvId);
  if (!cv) notFound();

  const selected =
    (typeof requested === "string" && cv.analyses.find((a) => a.id === requested)) ||
    cv.analyses[0];
  const kind = cvKindFromMime(cv.mimeType);
  const running = cv.analyses.some((a) => isActiveStatus(a.status));

  const report =
    selected?.status === "COMPLETED" ? await getMyAnalysisReport(cv.id, selected.id) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/cv"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All CVs
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <FileText className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-all sm:text-2xl">
              {cv.fileName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {kind ? CV_KINDS[kind].label : "File"} · {formatBytes(cv.fileSize)}
              {cv.pageCount ? ` · ${cv.pageCount} page${cv.pageCount === 1 ? "" : "s"}` : ""} ·
              Uploaded {formatDate(cv.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!running && (
            <AnalyzeCvButton
              cvId={cv.id}
              label={cv.analyses.length > 0 ? "Re-analyze" : "Analyze"}
              className="h-10 md:h-9"
            />
          )}
          <DeleteCvButton
            cvId={cv.id}
            fileName={cv.fileName}
            redirectTo="/dashboard/cv"
            className="h-10 md:h-9"
          />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {!selected ? (
            <EmptyState
              icon={Sparkles}
              title="Not analyzed yet"
              description="Run an analysis to get your score, skills, strengths, gaps and recommendations."
              action={<AnalyzeCvButton cvId={cv.id} label="Analyze" variant="default" />}
            />
          ) : isActiveStatus(selected.status) ? (
            <AnalysisProgress analysisId={selected.id} initialStage={selected.stage} />
          ) : selected.status === "FAILED" ? (
            <ErrorState
              title="This analysis didn't complete"
              description={cvErrorMessage(selected.errorCode)}
            />
          ) : report ? (
            <AnalysisReport report={report.report} provider={report.provider} />
          ) : (
            <ErrorState
              title="This report can't be displayed"
              description="The stored report is unreadable. Run the analysis again to get a fresh report."
            />
          )}
        </div>

        {cv.analyses.length > 0 && (
          <aside aria-labelledby="cv-history-heading" className="min-w-0 lg:sticky lg:top-24">
            <h2 id="cv-history-heading" className="mb-3 text-sm font-medium">
              Analysis history
            </h2>
            <AnalysisHistoryList
              selectedId={selected?.id}
              entries={cv.analyses.map((a) => ({
                id: a.id,
                cvId: cv.id,
                status: a.status,
                score: a.score,
                provider: a.provider,
                createdAt: a.createdAt,
              }))}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Re-analyzing creates a new entry; earlier reports are kept.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
