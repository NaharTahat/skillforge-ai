import { FlaskConical, Info, ShieldCheck } from "lucide-react";
import { GapsCard, RecommendationsCard, StrengthsCard } from "@/components/cv/report/findings";
import { ScoreOverview } from "@/components/cv/report/score-overview";
import { SkillsCard } from "@/components/cv/report/skills-card";
import { FormattingCard, SectionsCard } from "@/components/cv/report/structure-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CvAnalysisReport } from "@/lib/cv/analysis-schema";

const LEVEL_LABELS: Record<CvAnalysisReport["candidateProfile"]["experienceLevel"], string> = {
  STUDENT: "Student",
  ENTRY: "Entry level",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
  NOT_SPECIFIED: "Not specified",
};

function Notice({
  icon: Icon,
  children,
  tone = "info",
}: {
  icon: typeof Info;
  children: React.ReactNode;
  tone?: "info" | "warning";
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
      />
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

export function AnalysisReport({
  report,
  provider,
}: {
  report: CvAnalysisReport;
  provider: string;
}) {
  const { candidateProfile: profile } = report;
  const removed = report.grounding.removedSkills + report.grounding.removedStrengths;

  return (
    <div className="grid gap-6">
      {provider === "mock" && (
        <Notice icon={FlaskConical} tone="warning">
          <span className="font-medium text-foreground">Mock analysis.</span> This report was
          produced by the development mock provider using simple keyword rules — it is not an AI
          assessment. Configure an AI provider for real analysis.
        </Notice>
      )}
      {report.source.truncated && (
        <Notice icon={Info}>Your CV was very long, so only the first part was analyzed.</Notice>
      )}

      <ScoreOverview score={report.score} />

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm leading-relaxed">{report.summary}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Experience level</dt>
              <dd className="mt-0.5">{LEVEL_LABELS[profile.experienceLevel]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Primary domain</dt>
              <dd className="mt-0.5">{profile.primaryDomain || "Not specified"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Years of experience</dt>
              <dd className="mt-0.5">
                {profile.yearsOfExperience === null ? "Not specified" : profile.yearsOfExperience}
              </dd>
            </div>
          </dl>
          <div>
            <p className="text-xs text-muted-foreground">Target roles stated in the CV</p>
            {profile.targetRoles.length === 0 ? (
              <p className="mt-1 text-sm">Not specified</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {profile.targetRoles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SkillsCard skills={report.skills} />

      <div className="grid gap-6 xl:grid-cols-2">
        <StrengthsCard strengths={report.strengths} />
        <GapsCard gaps={report.gaps} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionsCard sections={report.sections} />
        <FormattingCard formatting={report.formatting} />
      </div>

      <RecommendationsCard recommendations={report.recommendations} />

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Findings are checked against your CV text before they&apos;re shown.
        {removed > 0 &&
          ` ${removed} item${removed === 1 ? " was" : "s were"} removed because ${removed === 1 ? "it" : "they"} couldn't be found in your CV.`}{" "}
        Scores are guidance, not a prediction of hiring outcomes.
      </p>
    </div>
  );
}
