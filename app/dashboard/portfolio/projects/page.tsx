import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FolderKanban, Pencil, Plus } from "lucide-react";
import { FeaturedToggle } from "@/components/portfolio/featured-toggle";
import {
  DeleteItemButton,
  VisibilityBadge,
  VisibilityToggle,
} from "@/components/portfolio/item-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMySettings, listMyProjects } from "@/lib/data/portfolio";
import { PROJECT_STATUS_LABELS } from "@/lib/portfolio/constants";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const [projects, settings] = await Promise.all([listMyProjects(), getMySettings()]);
  const portfolioPublic = Boolean(settings.passport?.isPublic && settings.username);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Projects are the strongest evidence for your skills. Link each one to the skills it demonstrates."
        actions={
          <Button asChild className="h-10 md:h-9">
            <Link href="/dashboard/portfolio/projects/new">
              <Plus />
              New project
            </Link>
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          titleAs="h2"
          title="No projects yet"
          description="Add something you've built — a course project, a side project or work you can share. Projects are private until you make them public."
          action={
            <Button asChild>
              <Link href="/dashboard/portfolio/projects/new">Add your first project</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2" aria-label="Your projects">
          {projects.map((p) => {
            const publicHref =
              portfolioPublic && p.visibility === "PUBLIC"
                ? `/p/${settings.username}/projects/${p.slug}`
                : null;
            return (
              <li
                key={p.id}
                className="flex flex-col rounded-xl border bg-card p-4 sm:p-5"
                data-testid="project-card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 font-medium break-words">
                    <Link
                      href={`/dashboard/portfolio/projects/${p.id}`}
                      className="rounded-sm hover:underline"
                    >
                      {p.title}
                    </Link>
                  </h2>
                  <VisibilityBadge visibility={p.visibility} />
                  <Badge variant="secondary" className="font-normal">
                    {PROJECT_STATUS_LABELS[p.status]}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-3 text-sm break-words text-muted-foreground">
                  {p.shortDescription}
                </p>
                {p.skills.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Linked skills">
                    {p.skills.map((s) => (
                      <li key={s.name}>
                        <Badge variant="outline" className="font-normal">
                          {s.name}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.technologies.length} technolog{p.technologies.length === 1 ? "y" : "ies"} ·{" "}
                  {p._count.evidence} evidence link
                  {p._count.evidence === 1 ? "" : "s"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Button asChild variant="outline" size="sm" className="h-9 sm:h-8">
                    <Link
                      href={`/dashboard/portfolio/projects/${p.id}`}
                      aria-label={`Edit ${p.title}`}
                    >
                      <Pencil />
                      Edit
                    </Link>
                  </Button>
                  {publicHref ? (
                    <Button asChild variant="outline" size="sm" className="h-9 sm:h-8">
                      <Link
                        href={publicHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Preview ${p.title} on your public portfolio`}
                      >
                        <ExternalLink />
                        Preview
                      </Link>
                    </Button>
                  ) : null}
                  <VisibilityToggle
                    kind="project"
                    id={p.id}
                    visibility={p.visibility}
                    label={p.title}
                  />
                  <FeaturedToggle id={p.id} featured={p.featured} label={p.title} />
                  <DeleteItemButton kind="project" id={p.id} label={p.title} what="project" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {projects.length > 0 && !portfolioPublic && (
        <p className="text-sm text-muted-foreground">
          Public previews appear once your portfolio is public.{" "}
          <Link href="/dashboard/portfolio/settings" className="text-brand hover:underline">
            Public settings
          </Link>
        </p>
      )}
    </div>
  );
}
