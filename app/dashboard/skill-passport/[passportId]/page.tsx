import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatDay } from "@/components/portfolio/format";
import { VisibilityBadge, VisibilityToggle } from "@/components/portfolio/item-actions";
import { LevelBadge } from "@/components/portfolio/skills-manager";
import { StrengthBadge } from "@/components/portfolio/strength-badge";
import { SkillSummaryEditor } from "@/components/skill-passport/skill-summary-editor";
import { PageHeader } from "@/components/shared/page-header";
import { getMySkill, type EvidenceItem } from "@/lib/data/portfolio";
import { idSchema } from "@/lib/portfolio/validation";

export const metadata: Metadata = { title: "Skill evidence" };

const TYPE_LABELS: Record<EvidenceItem["type"], string> = {
  PROJECT: "Projects",
  CERTIFICATION: "Certifications (user-provided)",
  ASSESSMENT: "Assessments",
  INTERVIEW: "AI Interviews",
  CV: "CV analysis",
  JOB_MATCH: "Job Match",
  ROADMAP: "Career Roadmap",
};

/** Per-skill evidence page. The route param is the user's own skill entry id (scoped to the session user). */
export default async function SkillEvidencePage({
  params,
}: PageProps<"/dashboard/skill-passport/[passportId]">) {
  const { passportId } = await params;
  if (!idSchema.safeParse(passportId).success) notFound();
  const skill = await getMySkill(passportId);
  if (!skill) notFound();

  const groups = Map.groupBy(skill.evidence.items, (i) => i.type);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/skill-passport"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Skill Passport
      </Link>
      <PageHeader
        title={skill.name}
        description="Everything in SkillForge that supports this skill."
        actions={
          <VisibilityToggle
            kind="skill"
            id={skill.id}
            visibility={skill.visibility}
            label={skill.name}
          />
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="evidence-list-heading"
            className="rounded-xl border bg-card p-4 sm:p-6"
          >
            <h2 id="evidence-list-heading" className="font-medium">
              Evidence ({skill.evidence.items.length})
            </h2>
            {skill.evidence.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No evidence yet. Link this skill to a project or certification, or take an
                assessment that covers it.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {[...groups].map(([type, items]) => (
                  <div key={type}>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                      {TYPE_LABELS[type]}
                    </h3>
                    <ul className="grid gap-2">
                      {items.map((i, n) => (
                        <li key={`${i.href}-${n}`}>
                          <Link
                            href={i.href}
                            className="flex items-center justify-between gap-3 rounded-lg border p-3 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-medium break-words">
                                {i.label}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {i.detail}
                                {i.date ? ` · ${formatDay(i.date)}` : ""}
                              </span>
                            </span>
                            <ArrowRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
          <SkillSummaryEditor
            skill={{
              id: skill.id,
              name: skill.name,
              level: skill.level,
              visibility: skill.visibility,
              summary: skill.summary,
            }}
            hasEvidence={skill.evidence.items.length > 0}
          />
        </div>

        <section
          aria-labelledby="skill-facts-heading"
          className="rounded-xl border bg-card p-4 sm:p-6"
        >
          <h2 id="skill-facts-heading" className="mb-3 font-medium">
            Overview
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Visibility</dt>
            <dd>
              <VisibilityBadge visibility={skill.visibility} />
            </dd>
            <dt className="text-muted-foreground">Your level</dt>
            <dd>
              <LevelBadge level={skill.level} />{" "}
              <span className="text-xs text-muted-foreground">self-assessed</span>
            </dd>
            <dt className="text-muted-foreground">Evidence strength</dt>
            <dd>
              <StrengthBadge
                label={skill.evidence.strength.label}
                score={skill.evidence.strength.score}
              />{" "}
              <span className="text-xs text-muted-foreground tabular-nums">
                {skill.evidence.strength.score}/100
              </span>
            </dd>
            <dt className="text-muted-foreground">Latest assessment</dt>
            <dd>
              {skill.evidence.latestAssessment
                ? `${skill.evidence.latestAssessment.percentage}% · ${skill.evidence.latestAssessment.label}`
                : "None yet"}
            </dd>
            <dt className="text-muted-foreground">Last assessed</dt>
            <dd>
              {skill.evidence.lastAssessed ? formatDay(skill.evidence.lastAssessed) : "Never"}
            </dd>
          </dl>
          <Link
            href="/dashboard/portfolio/skills"
            className="mt-3 inline-flex min-h-10 items-center rounded-sm text-sm text-brand hover:underline"
          >
            Change your level on the Skills tab
          </Link>
        </section>
      </div>
    </div>
  );
}
