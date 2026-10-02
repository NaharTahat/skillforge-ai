import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SkillProgress } from "@/types/dashboard";

export function SkillsProgressCard({ skills }: { skills: SkillProgress[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills progress</CardTitle>
        <CardDescription>Estimated proficiency for your goal</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/assessments">Assess</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {skills.map((skill) => (
            <li key={skill.name}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>{skill.name}</span>
                <span className="text-muted-foreground tabular-nums">{skill.proficiency}%</span>
              </div>
              <Progress
                value={skill.proficiency}
                className="h-1.5"
                aria-label={`${skill.name} proficiency`}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
