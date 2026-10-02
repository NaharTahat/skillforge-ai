import { Briefcase, FileText, Route } from "lucide-react";
import { StatCard } from "@/components/dashboard/overview/stat-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CvStatusSummary, JobMatchSummary, RoadmapSummary } from "@/types/dashboard";

export function CvStatusStat({ cv }: { cv: CvStatusSummary }) {
  switch (cv.state) {
    case "missing":
      return (
        <StatCard
          title="CV status"
          icon={FileText}
          href="/dashboard/cv"
          value="—"
          caption="Upload your CV to get started"
        />
      );
    case "processing":
      return (
        <StatCard
          title="CV status"
          icon={FileText}
          href="/dashboard/cv"
          value={<span className="text-xl">Analyzing…</span>}
          caption={cv.fileName}
        />
      );
    case "analyzed":
      return (
        <StatCard
          title="CV status"
          icon={FileText}
          href="/dashboard/cv"
          value={
            <span className="flex items-baseline gap-2">
              {cv.score}
              <span className="text-base font-normal text-muted-foreground">/ 100</span>
            </span>
          }
          caption={<span className="block truncate">{cv.fileName}</span>}
          footer={
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Analyzed
            </Badge>
          }
        />
      );
  }
}

export function JobMatchesStat({ matches }: { matches: JobMatchSummary }) {
  return (
    <StatCard
      title="Job matches"
      icon={Briefcase}
      href="/dashboard/job-match"
      value={
        <span className="flex items-baseline gap-2">
          {matches.strong}
          <span className="text-base font-normal text-muted-foreground">strong</span>
        </span>
      }
      caption={`${matches.potential} potential matches`}
      footer={
        matches.topMatch && (
          <p className="truncate text-xs text-muted-foreground">
            Top: <span className="text-foreground">{matches.topMatch.title}</span> ·{" "}
            {matches.topMatch.matchPercent}%
          </p>
        )
      }
    />
  );
}

export function RoadmapStat({ roadmap }: { roadmap: RoadmapSummary }) {
  return (
    <StatCard
      title="Roadmap"
      icon={Route}
      href="/dashboard/roadmap"
      value={`${roadmap.completedPercent}%`}
      caption={`${roadmap.completedItems} of ${roadmap.totalItems} stages completed`}
      footer={
        <Progress
          value={roadmap.completedPercent}
          className="h-1.5"
          aria-label="Roadmap progress"
        />
      }
    />
  );
}
