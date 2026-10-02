import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Info } from "lucide-react";
import { AssessmentsSummaryCard } from "@/components/dashboard/overview/assessments-summary-card";
import { InterviewCard } from "@/components/dashboard/overview/interview-card";
import { ReadinessCard } from "@/components/dashboard/overview/readiness-card";
import { RecentActivityCard } from "@/components/dashboard/overview/recent-activity-card";
import { RecommendedSkillsCard } from "@/components/dashboard/overview/recommended-skills-card";
import { SkillsProgressCard } from "@/components/dashboard/overview/skills-progress-card";
import {
  CvStatusStat,
  JobMatchesStat,
  RoadmapStat,
} from "@/components/dashboard/overview/summary-stats";
import { ProfileCompletionPrompt } from "@/components/profile/profile-completion-prompt";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getAssessmentDashboardSummary } from "@/lib/data/assessment";
import { getMyProfile } from "@/lib/data/profile";
import { dashboardService } from "@/lib/services/dashboard";

export default async function DashboardPage() {
  // Per-request data (relative timestamps and the signed-in user).
  await connection();
  const user = await requireUser();
  const [overview, profile, assessmentSummary] = await Promise.all([
    dashboardService.getOverview(user.id),
    getMyProfile(),
    getAssessmentDashboardSummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.firstName ? `Welcome back, ${user.firstName}` : "Welcome back"}
        description="Here's your career overview."
        actions={
          overview.roadmap.nextItem && (
            <Button asChild>
              <Link href="/dashboard/roadmap">
                Continue roadmap <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )
        }
      />

      {profile.completion.percent < 100 && (
        <ProfileCompletionPrompt completion={profile.completion} />
      )}

      {/* Real data — deliberately outside the sample-data section below. */}
      <AssessmentsSummaryCard summary={assessmentSummary} />

      {overview.source === "mock" && (
        <div className="flex items-start gap-3 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Sample data.</span> These figures are
            placeholders that show how your dashboard will look. They are not generated from your CV
            or activity.
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <ReadinessCard score={overview.careerReadiness} goal={overview.careerGoal} />
        <div className="grid gap-4 sm:grid-cols-3 xl:col-span-2">
          <CvStatusStat cv={overview.cv} />
          <JobMatchesStat matches={overview.jobMatches} />
          <RoadmapStat roadmap={overview.roadmap} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SkillsProgressCard skills={overview.skills} />
        <InterviewCard interview={overview.interview} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecommendedSkillsCard skills={overview.recommendedSkills} />
        <RecentActivityCard items={overview.recentActivity} />
      </div>
    </div>
  );
}
