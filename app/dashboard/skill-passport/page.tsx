import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ExternalLink } from "lucide-react";
import { formatDay } from "@/components/portfolio/format";
import { VisibilityBadge } from "@/components/portfolio/item-actions";
import { CopyLinkButton } from "@/components/portfolio/share";
import { LevelBadge } from "@/components/portfolio/skills-manager";
import { StrengthBadge } from "@/components/portfolio/strength-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getMySettings, listMySkills } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "Skill Passport" };

export default async function SkillPassportPage() {
  const [skills, settings] = await Promise.all([listMySkills(), getMySettings()]);
  const sharePath =
    settings.passport?.isPublic && settings.username ? `/p/${settings.username}/skills` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Passport"
        description="Each skill with the evidence behind it. Levels are your own; evidence strength is calculated from your SkillForge records."
        actions={
          sharePath ? (
            <>
              <CopyLinkButton path={sharePath} label="Share Skill Passport" />
              <Button asChild variant="outline" className="h-10 md:h-9">
                <Link href={sharePath} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Public view
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="h-10 md:h-9">
              <Link href="/dashboard/portfolio/settings">Make it public</Link>
            </Button>
          )
        }
      />

      <details className="rounded-xl border bg-card px-4 py-1.5 text-sm sm:px-6">
        <summary className="cursor-pointer py-2.5 font-medium">
          How evidence strength is calculated
        </summary>
        <ul className="mt-1 mb-2.5 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Latest assessment: 90–100% Strong evidence, 75–89% Good evidence, 60–74% Developing,
            below 60% Needs improvement.
          </li>
          <li>
            Linked projects (completed or in progress) and certifications count, up to two each.
          </li>
          <li>
            AI Interview answers on the skill, a quote in your CV analysis, Job Match results and
            completed roadmap tasks add smaller amounts.
          </li>
          <li>
            Certifications and evidence links are user-provided; SkillForge does not verify them.
          </li>
          <li>
            Your public page only uses public projects and certifications, plus assessment and
            interview evidence if you allow it.
          </li>
        </ul>
      </details>

      {skills.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          titleAs="h2"
          title="No skills in your passport yet"
          description="Add skills on the Portfolio Skills tab, then link projects and certifications to build evidence."
          action={
            <Button asChild>
              <Link href="/dashboard/portfolio/skills">Add skills</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Skills">
          {skills.map((s) => {
            const projects = s.evidence.items.filter((i) => i.type === "PROJECT");
            return (
              <li
                key={s.id}
                className="flex flex-col rounded-xl border bg-card p-4 sm:p-5"
                data-testid="passport-skill"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium break-words">{s.name}</h2>
                  <VisibilityBadge visibility={s.visibility} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <LevelBadge level={s.level} />
                  <StrengthBadge
                    label={s.evidence.strength.label}
                    score={s.evidence.strength.score}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Evidence</dt>
                  <dd>{s.evidence.items.length}</dd>
                  <dt className="text-muted-foreground">Latest assessment</dt>
                  <dd>
                    {s.evidence.latestAssessment
                      ? `${s.evidence.latestAssessment.percentage}% · ${s.evidence.latestAssessment.label}`
                      : "None yet"}
                  </dd>
                  <dt className="text-muted-foreground">Last assessed</dt>
                  <dd>{s.evidence.lastAssessed ? formatDay(s.evidence.lastAssessed) : "Never"}</dd>
                  <dt className="text-muted-foreground">Projects</dt>
                  <dd className="min-w-0 break-words">
                    {projects.length ? projects.map((p) => p.label).join(", ") : "None linked"}
                  </dd>
                </dl>
                <div className="mt-4 border-t pt-3">
                  <Link
                    href={`/dashboard/skill-passport/${s.id}`}
                    className="inline-flex min-h-10 items-center gap-1 rounded-sm text-sm text-brand hover:underline"
                    aria-label={`View evidence for ${s.name}`}
                  >
                    View evidence
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
