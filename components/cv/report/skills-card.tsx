import { BadgeCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  type CvAnalysisReport,
} from "@/lib/cv/analysis-schema";

type Skill = CvAnalysisReport["skills"][number];

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return "Clearly shown";
  if (confidence >= 0.5) return "Mentioned";
  return "Briefly mentioned";
}

export function SkillsCard({ skills }: { skills: Skill[] }) {
  const groups = SKILL_CATEGORIES.map((category) => ({
    category,
    skills: skills
      .filter((s) => s.category === category)
      .sort((a, b) => b.confidence - a.confidence),
  })).filter((g) => g.skills.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Detected skills
        </CardTitle>
        <CardDescription>
          {skills.length} skill{skills.length === 1 ? "" : "s"}, each with the CV text it was found
          in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title="No skills could be verified"
            description="We only list skills we can quote from your CV. Consider adding a clear skills section."
            className="py-8"
          />
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <section key={group.category} aria-label={SKILL_CATEGORY_LABELS[group.category]}>
                <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {SKILL_CATEGORY_LABELS[group.category]}
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.skills.map((skill) => (
                    <li key={skill.name} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{skill.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {confidenceLabel(skill.confidence)}
                        </span>
                      </div>
                      <blockquote className="mt-1.5 line-clamp-3 border-l-2 border-brand/40 pl-2 text-xs text-muted-foreground">
                        {skill.verified ? `“${skill.evidence}”` : "Named in your CV"}
                      </blockquote>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
