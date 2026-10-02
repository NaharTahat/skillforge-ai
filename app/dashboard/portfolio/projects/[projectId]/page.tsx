import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EvidenceManager } from "@/components/portfolio/evidence-manager";
import { toDateInput } from "@/components/portfolio/format";
import { DeleteItemButton, VisibilityBadge } from "@/components/portfolio/item-actions";
import { ProjectForm } from "@/components/portfolio/project-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getMyProject, getMySettings, mySkillOptions } from "@/lib/data/portfolio";
import { idSchema } from "@/lib/portfolio/validation";

export const metadata: Metadata = { title: "Edit project" };

export default async function ProjectPage({
  params,
}: PageProps<"/dashboard/portfolio/projects/[projectId]">) {
  const { projectId } = await params;
  if (!idSchema.safeParse(projectId).success) notFound();
  const [project, skills, settings] = await Promise.all([
    getMyProject(projectId),
    mySkillOptions(),
    getMySettings(),
  ]);
  if (!project) notFound();

  const linked = new Set(project.skills.map((s) => s.id));
  const publicHref =
    settings.passport?.isPublic && settings.username && project.visibility === "PUBLIC"
      ? `/p/${settings.username}/projects/${project.slug}`
      : null;

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
        title={project.title}
        description="Edit details, link skills and add evidence."
        actions={
          <>
            <VisibilityBadge visibility={project.visibility} />
            {publicHref && (
              <Button asChild variant="outline" className="h-10 md:h-9">
                <Link href={publicHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Preview
                </Link>
              </Button>
            )}
            <DeleteItemButton
              kind="project"
              id={project.id}
              label={project.title}
              what="project"
              redirectTo="/dashboard/portfolio/projects"
              className="h-10 md:h-9"
            />
          </>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ProjectForm
          key={project.id}
          projectId={project.id}
          skills={skills.map((s) => ({ id: s.id, name: s.name }))}
          initial={{
            title: project.title,
            shortDescription: project.shortDescription,
            description: project.description ?? "",
            role: project.role ?? "",
            technologies: project.technologies,
            skillIds: skills.filter((s) => linked.has(s.skillId)).map((s) => s.id),
            repositoryUrl: project.repositoryUrl ?? "",
            liveUrl: project.liveUrl ?? "",
            imageUrl: project.imageUrl ?? "",
            startDate: toDateInput(project.startDate),
            endDate: toDateInput(project.endDate),
            status: project.status,
            featured: project.featured,
            visibility: project.visibility,
          }}
        />
        <EvidenceManager projectId={project.id} evidence={project.evidence} />
      </div>
    </div>
  );
}
