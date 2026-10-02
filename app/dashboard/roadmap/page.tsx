import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, Map } from "lucide-react";
import { CareerGoalRoadmapForm, JobMatchRoadmapForm } from "@/components/roadmap/create-roadmap";
import { RoadmapHistory } from "@/components/roadmap/roadmap-history";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getRoadmapSources, listMyRoadmaps } from "@/lib/data/roadmap";
import { roadmapErrorMessage } from "@/lib/roadmap/errors";

export const metadata: Metadata = { title: "Career Roadmap" };

export default async function RoadmapPage() {
  const [sources, roadmaps] = await Promise.all([getRoadmapSources(), listMyRoadmaps()]);
  const ready = sources.analyzedCvs.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Career Roadmap"
        description="Turn your skill gaps into an actionable plan."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-1 gap-6">
          {!ready ? (
            <EmptyState
              icon={FileSearch}
              titleAs="h2"
              title={roadmapErrorMessage(sources.hasCv ? "CV_NOT_ANALYZED" : "NO_CV")}
              description={
                sources.hasCv
                  ? "Your roadmap is built from a completed CV analysis. Open the CV Analyzer to finish or re-run it."
                  : "A roadmap compares your CV with a target role. Upload and analyze a CV, then come back here."
              }
              action={
                <Button asChild>
                  <Link href="/dashboard/cv">Go to CV Analyzer</Link>
                </Button>
              }
            />
          ) : (
            <>
              <JobMatchRoadmapForm jobMatches={sources.jobMatches} />
              <CareerGoalRoadmapForm
                analyzedCvs={sources.analyzedCvs}
                careerGoal={sources.careerGoal}
                experienceLevel={sources.experienceLevel}
              />
            </>
          )}
        </div>

        <section aria-labelledby="roadmap-history-heading" className="min-w-0">
          <h2 id="roadmap-history-heading" className="mb-3 font-medium">
            Your roadmaps
          </h2>
          {roadmaps.length === 0 ? (
            <EmptyState
              icon={Map}
              title="No roadmaps yet"
              description="Your roadmaps will appear here, so you can reopen, re-generate or delete them."
              className="py-10"
            />
          ) : (
            <RoadmapHistory roadmaps={roadmaps} />
          )}
        </section>
      </div>
    </div>
  );
}
