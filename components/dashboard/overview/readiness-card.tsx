import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function readinessLabel(score: number) {
  if (score >= 80) return "Interview-ready for most roles";
  if (score >= 60) return "Close — a few targeted gaps remain";
  if (score >= 40) return "Building momentum";
  return "Early stage — focus on fundamentals";
}

export function ReadinessCard({ score, goal }: { score: number; goal: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 size-48 rounded-full bg-brand/10 blur-3xl"
      />
      <CardHeader>
        <CardTitle>Career readiness</CardTitle>
        <CardDescription>Toward {goal}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 pt-2 pb-2 sm:flex-row">
        <ReadinessRing value={score} size={120} label="Career readiness" />
        <p className="text-center text-sm text-muted-foreground sm:text-left">
          {readinessLabel(score)}
        </p>
      </CardContent>
    </Card>
  );
}
