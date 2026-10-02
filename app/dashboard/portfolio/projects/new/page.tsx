import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EMPTY_PROJECT, ProjectForm } from "@/components/portfolio/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { mySkillOptions } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const skills = await mySkillOptions();
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/portfolio/projects"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to projects
      </Link>
      <PageHeader
        title="New project"
        description="Describe something you actually built. You can add evidence links after saving."
      />
      <ProjectForm
        projectId={null}
        initial={EMPTY_PROJECT}
        skills={skills.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
