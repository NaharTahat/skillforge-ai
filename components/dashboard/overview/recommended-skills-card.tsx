import { Lightbulb } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendedSkill } from "@/types/dashboard";

export function RecommendedSkillsCard({ skills }: { skills: RecommendedSkill[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended skills</CardTitle>
        <CardDescription>Highest-impact gaps for your goal</CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No recommendations yet"
            description="Analyze your CV and a few job descriptions to get skill recommendations."
            className="py-8"
          />
        ) : (
          <ul className="divide-y">
            {skills.map((skill) => (
              <li
                key={skill.name}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{skill.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{skill.reason}</p>
                </div>
                <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                  {skill.demandCount} jobs
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
