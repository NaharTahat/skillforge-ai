import Link from "next/link";
import { StrengthBadge } from "@/components/portfolio/strength-badge";
import { formatDay } from "@/components/portfolio/format";
import { Badge } from "@/components/ui/badge";
import { SKILL_LEVEL_LABELS } from "@/lib/portfolio/constants";
import type { PublicPortfolio } from "@/lib/data/public-portfolio";

type PublicSkill = PublicPortfolio["skills"][number];

export function PublicSkillCard({
  skill,
  username,
  detailed = false,
}: {
  skill: PublicSkill;
  username: string;
  detailed?: boolean;
}) {
  // The detailed card sits directly under the page's h1 (Skill Passport page).
  const Heading = detailed ? "h2" : "h3";
  return (
    <article
      className="flex h-full flex-col rounded-xl border bg-card p-4"
      data-testid="public-skill"
    >
      <Heading className="font-medium break-words">{skill.name}</Heading>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="font-normal">
          {SKILL_LEVEL_LABELS[skill.level]} · self-assessed
        </Badge>
        <StrengthBadge label={skill.strength.label} score={skill.strength.score} />
      </div>
      {skill.summary && (
        <p className="mt-2 text-sm break-words text-muted-foreground">{skill.summary}</p>
      )}
      {detailed && (
        <dl className="mt-3 grid gap-2 text-sm">
          {skill.assessment && (
            <div>
              <dt className="text-muted-foreground">Latest SkillForge assessment</dt>
              <dd>
                {skill.assessment.percentage}% · {skill.assessment.label} ·{" "}
                {formatDay(skill.assessment.date)}
              </dd>
            </div>
          )}
          {skill.interviewAnswers > 0 && (
            <div>
              <dt className="text-muted-foreground">AI Interview practice</dt>
              <dd>
                {skill.interviewAnswers} evaluated answer{skill.interviewAnswers === 1 ? "" : "s"}
              </dd>
            </div>
          )}
          {skill.projects.length > 0 && (
            <div>
              <dt className="text-muted-foreground">Projects</dt>
              <dd>
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {skill.projects.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/p/${username}/projects/${p.slug}`}
                        className="inline-flex min-h-10 items-center text-brand hover:underline sm:min-h-0"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {skill.certifications.length > 0 && (
            <div>
              <dt className="text-muted-foreground">Certifications (user-provided)</dt>
              <dd>{skill.certifications.map((c) => `${c.name} — ${c.issuer}`).join("; ")}</dd>
            </div>
          )}
          {!skill.assessment &&
            skill.interviewAnswers === 0 &&
            skill.projects.length === 0 &&
            skill.certifications.length === 0 && (
              <p className="text-muted-foreground">No public evidence yet.</p>
            )}
        </dl>
      )}
    </article>
  );
}
