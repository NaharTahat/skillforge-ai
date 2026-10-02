import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CvAnalysisReport } from "@/lib/cv/analysis-schema";

function band(score: number) {
  if (score >= 80) return "Strong CV — mostly refinements left";
  if (score >= 65) return "Solid foundation with clear improvements available";
  if (score >= 45) return "Several important areas to strengthen";
  return "Needs substantial work before applying";
}

export function ScoreOverview({ score }: { score: CvAnalysisReport["score"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Overall score
        </CardTitle>
        <CardDescription>Weighted across seven dimensions</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col items-center gap-3 text-center">
          <ReadinessRing value={score.overall} size={148} label="Overall CV score" />
          <p className="text-2xl font-semibold tabular-nums">
            {score.overall}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </p>
          <p className="text-sm text-muted-foreground">{band(score.overall)}</p>
        </div>

        <div className="min-w-0">
          <ul className="grid gap-4">
            {score.dimensions.map((d) => (
              <li key={d.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{d.label}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {d.rating}/10 · <span className="text-foreground">{d.points}</span> of{" "}
                    {d.weight} pts
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${d.label}: ${d.rating} out of 10`}
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${d.rating * 10}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{d.rationale}</p>
              </li>
            ))}
          </ul>
          <details className="mt-5 rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              How this score is calculated
            </summary>
            <p className="mt-2">
              Each dimension is rated 0–10 against a fixed rubric. The overall score is the weighted
              sum: rating ÷ 10 × weight, with weights adding up to 100. Areas your CV doesn&apos;t
              cover receive low ratings. Scoring version {score.version}.
            </p>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
