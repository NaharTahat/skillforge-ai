import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobMatchReport } from "@/lib/job-match/schema";
import { matchBand } from "@/lib/job-match/scoring";
import { cn } from "@/lib/utils";

export function MatchScoreCard({ report }: { report: JobMatchReport }) {
  const { score } = report;
  const applicable = score.dimensions.filter((d) => d.score !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Profile-to-job match
        </CardTitle>
        <CardDescription>How closely your CV aligns with this job description</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col items-center gap-3 text-center">
          <ReadinessRing value={score.overall} size={148} label="Profile-to-job match" />
          <p className="text-2xl font-semibold tabular-nums">
            {score.overall}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </p>
          <p className="text-sm font-medium">{matchBand(score.overall)}</p>
          <p className="text-xs text-muted-foreground">
            Based on {applicable.length} of {score.dimensions.length} dimensions that apply to this
            job.
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="sr-only">Match breakdown</h3>
          <ul className="grid gap-4">
            {score.dimensions.map((d) => (
              <li key={d.key} className={cn(d.score === null && "opacity-70")}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {d.label}
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      {d.basis === "evidence" ? "Evidence" : "AI rating"}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {d.score === null ? (
                      "Not applicable"
                    ) : (
                      <>
                        <span className="text-foreground">{d.score}</span>/100 · weight{" "}
                        {d.effectiveWeight}%
                      </>
                    )}
                  </span>
                </div>
                {d.score !== null && (
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${d.label}: ${d.score} out of 100`}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">{d.detail}</p>
              </li>
            ))}
          </ul>
          <details className="mt-5 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              How this score is calculated
            </summary>
            <p className="mt-2">
              Evidence dimensions count requirements found in your CV (found = full credit,
              partially shown = half), weighted by importance. Experience, education and projects
              use a 0–10 AI rating with a written rationale. Dimensions the job doesn&apos;t specify
              are skipped and their weight is shared across the rest. The score describes
              profile-to-job alignment — it is not a probability of being hired. Scoring version{" "}
              {score.version}.
            </p>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
