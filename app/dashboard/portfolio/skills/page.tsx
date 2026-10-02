import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AddSkillForm, SkillsList } from "@/components/portfolio/skills-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listMySkills } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const skills = await listMySkills();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="List the skills you want to show, then back them up by linking projects and certifications."
      />
      <AddSkillForm />
      <section aria-labelledby="skills-list-heading" className="space-y-3">
        <h2 id="skills-list-heading" className="font-medium">
          Your skills ({skills.length})
        </h2>
        {skills.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No skills yet"
            description="Add your first skill above. New skills are private until you make them public."
          />
        ) : (
          <SkillsList
            skills={skills.map((s) => ({
              id: s.id,
              name: s.name,
              level: s.level,
              visibility: s.visibility,
              summary: s.summary,
              strength: { score: s.evidence.strength.score, label: s.evidence.strength.label },
              evidenceCount: s.evidence.items.length,
            }))}
          />
        )}
      </section>
    </div>
  );
}
