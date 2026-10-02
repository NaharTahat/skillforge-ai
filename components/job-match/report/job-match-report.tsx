import { FlaskConical, Info, ShieldCheck } from "lucide-react";
import {
  InterviewTopicsCard,
  KeywordCoverageCard,
  RecommendationsCard,
  RoleOverviewCard,
  StrengthsCard,
} from "@/components/job-match/report/insights";
import { RequirementsSection } from "@/components/job-match/report/requirements-section";
import { MatchScoreCard } from "@/components/job-match/report/score-header";
import type { JobMatchReport as Report } from "@/lib/job-match/schema";

function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Info;
  tone: "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warning"
          ? "flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm"
          : "flex items-start gap-3 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm"
      }
    >
      <Icon
        className={
          tone === "warning"
            ? "mt-0.5 size-4 shrink-0 text-warning"
            : "mt-0.5 size-4 shrink-0 text-brand"
        }
        aria-hidden
      />
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export function JobMatchReport({ report, provider }: { report: Report; provider: string }) {
  const { removedRequirements, adjustedRequirements } = report.grounding;

  return (
    <div className="grid gap-6">
      {provider === "mock" && (
        <Notice icon={FlaskConical} tone="warning">
          <span className="font-medium text-foreground">Mock analysis.</span> This match was
          produced by the development mock provider using simple keyword rules — it is not an AI
          assessment. Configure an AI provider for real analysis.
        </Notice>
      )}
      {report.source.cvTruncated && (
        <Notice icon={Info} tone="info">
          Your CV was very long, so only its first part was compared.
        </Notice>
      )}

      <MatchScoreCard report={report} />
      <RoleOverviewCard report={report} />
      <RequirementsSection requirements={report.requirements} />

      <div className="grid gap-6 xl:grid-cols-2">
        <StrengthsCard strengths={report.strengths} />
        <KeywordCoverageCard coverage={report.keywordCoverage} />
      </div>

      <RecommendationsCard recommendations={report.recommendations} />
      <InterviewTopicsCard topics={report.interviewTopics} />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Every requirement is checked against the job description and your CV before it&apos;s
          shown.
          {removedRequirements > 0 &&
            ` ${removedRequirements} requirement${removedRequirements === 1 ? " was" : "s were"} removed because ${removedRequirements === 1 ? "it" : "they"} couldn't be found in the job description.`}
          {adjustedRequirements > 0 &&
            ` ${adjustedRequirements} match level${adjustedRequirements === 1 ? " was" : "s were"} corrected against your CV text.`}{" "}
          This is guidance on alignment, not a prediction of hiring outcomes.
        </span>
      </p>
    </div>
  );
}
