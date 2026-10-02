import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Target } from "lucide-react";
import { AnalysisStatusBadge, isActiveStatus } from "@/components/cv/analysis-status-badge";
import { DeleteRoadmapButton, RegenerateRoadmapButton } from "@/components/roadmap/roadmap-actions";
import { RoadmapProgress } from "@/components/roadmap/roadmap-progress";
import { RoadmapReport } from "@/components/roadmap/roadmap-report";
import { ErrorState } from "@/components/shared/error-state";
import { getMyRoadmap } from "@/lib/data/roadmap";
import { formatDate } from "@/lib/format";
import { roadmapErrorMessage } from "@/lib/roadmap/errors";

export const metadata: Metadata = { title: "Career roadmap" };

export default async function RoadmapDetailPage({
  params,
}: PageProps<"/dashboard/roadmap/[roadmapId]">) {
  const { roadmapId } = await params;

  // Ownership is part of the query: another user's roadmap looks exactly like a missing one.
  const roadmap = await getMyRoadmap(roadmapId);
  if (!roadmap) notFound();

  const running = isActiveStatus(roadmap.status);
  const Icon = roadmap.sourceType === "JOB_MATCH" ? Briefcase : Target;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/roadmap"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All roadmaps
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border bg-muted/40">
            <Icon className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
              {roadmap.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {roadmap.sourceType === "JOB_MATCH"
                ? "Job roadmap · from Job Match"
                : `Career-goal roadmap · ${roadmap.careerGoalLabel ?? roadmap.goal}`}
              {" · "}Created {formatDate(roadmap.createdAt)}
            </p>
            <div className="mt-2">
              <AnalysisStatusBadge status={roadmap.status} />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!running && (
            <RegenerateRoadmapButton
              roadmapId={roadmap.id}
              label={roadmap.title}
              className="h-10 md:h-9"
            />
          )}
          <DeleteRoadmapButton
            roadmapId={roadmap.id}
            label={roadmap.title}
            redirectTo="/dashboard/roadmap"
            className="h-10 md:h-9"
          />
        </div>
      </div>

      {running ? (
        <RoadmapProgress roadmapId={roadmap.id} initialStage={roadmap.stage} />
      ) : roadmap.status === "FAILED" ? (
        <ErrorState
          title="This roadmap didn't complete"
          description={roadmapErrorMessage(roadmap.errorCode)}
        />
      ) : roadmap.report ? (
        <RoadmapReport roadmap={roadmap} report={roadmap.report} />
      ) : (
        <ErrorState
          title="This roadmap can't be displayed"
          description="The stored roadmap is unreadable. Re-generate it to get a fresh one."
        />
      )}

      {roadmap.regeneratedFromId && (
        <p className="text-xs text-muted-foreground">
          Re-generated from an earlier roadmap, which is kept in{" "}
          <Link href="/dashboard/roadmap" className="text-brand hover:underline">
            your roadmaps
          </Link>
          .
        </p>
      )}
    </div>
  );
}
