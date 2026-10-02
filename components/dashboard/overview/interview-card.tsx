import Link from "next/link";
import { InterviewTrendChart } from "@/components/dashboard/overview/interview-trend-chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InterviewSummary } from "@/types/dashboard";

export function InterviewCard({ interview }: { interview: InterviewSummary }) {
  const first = interview.history[0]?.score;
  const delta = first === undefined ? null : interview.latestScore - first;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interview performance</CardTitle>
        <CardDescription>{interview.sessionsCompleted} practice sessions</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/interview">Practice</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {interview.latestScore}%
          </span>
          {delta !== null && delta !== 0 && (
            <span className="text-sm text-muted-foreground">
              {delta > 0 ? "+" : ""}
              {delta} pts since first session
            </span>
          )}
        </div>
        <div className="mt-4">
          <InterviewTrendChart data={interview.history} />
        </div>
      </CardContent>
    </Card>
  );
}
