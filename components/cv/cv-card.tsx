import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { AnalyzeCvButton, DeleteCvButton } from "@/components/cv/cv-actions";
import { AnalysisStatusBadge, isActiveStatus } from "@/components/cv/analysis-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CV_KINDS, cvKindFromMime, formatBytes } from "@/lib/cv/constants";
import type { MyCvListItem } from "@/lib/data/cv";
import { formatDate } from "@/lib/format";

export function CvCard({ cv }: { cv: MyCvListItem }) {
  const latest = cv.analyses[0];
  const kind = cvKindFromMime(cv.mimeType);
  const href = `/dashboard/cv/${cv.id}`;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <FileText className="size-4.5 text-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={href}
              className="-my-1 block truncate rounded-sm py-1 font-medium hover:underline"
              title={cv.fileName}
            >
              {cv.fileName}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {kind ? CV_KINDS[kind].label : "File"} · {formatBytes(cv.fileSize)} · Uploaded{" "}
              {formatDate(cv.createdAt)}
            </p>
          </div>
          {latest?.status === "COMPLETED" && latest.score !== null && (
            <div className="text-right">
              <p className="text-2xl leading-none font-semibold tabular-nums">{latest.score}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">/ 100</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStatusBadge status={latest?.status} />
          {cv._count.analyses > 1 && (
            <span className="text-xs text-muted-foreground">{cv._count.analyses} analyses</span>
          )}
          {latest?.provider === "mock" && latest.status === "COMPLETED" && (
            <span className="text-xs text-muted-foreground">· Mock result</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {latest?.status === "COMPLETED" ? (
            <>
              <Button asChild size="sm" className="h-9 sm:h-8">
                <Link href={`${href}?analysis=${latest.id}`}>
                  View analysis <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <AnalyzeCvButton cvId={cv.id} label="Re-analyze" size="sm" className="h-9 sm:h-8" />
            </>
          ) : isActiveStatus(latest?.status) ? (
            <Button asChild size="sm" variant="outline" className="h-9 sm:h-8">
              <Link href={`${href}?analysis=${latest!.id}`}>View progress</Link>
            </Button>
          ) : (
            <AnalyzeCvButton
              cvId={cv.id}
              label="Analyze"
              variant="default"
              size="sm"
              className="h-9 sm:h-8"
            />
          )}
          <DeleteCvButton
            cvId={cv.id}
            fileName={cv.fileName}
            size="sm"
            className="ml-auto h-9 sm:h-8"
          />
        </div>
      </CardContent>
    </Card>
  );
}
