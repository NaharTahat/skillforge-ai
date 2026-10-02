import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { formatRange } from "@/components/portfolio/format";
import { SafeLink } from "@/components/public-portfolio/public-shell";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/config/site";
import { loadPublicProject } from "@/lib/data/public-cache";
import { EVIDENCE_KIND_LABELS, PROJECT_STATUS_LABELS } from "@/lib/portfolio/constants";

export async function generateMetadata({
  params,
}: PageProps<"/p/[username]/projects/[projectSlug]">): Promise<Metadata> {
  await connection();
  const { username, projectSlug } = await params;
  const data = await loadPublicProject(username, projectSlug);
  if (!data) return { title: "Project not available", robots: { index: false } };
  const title = `${data.project.title} — ${data.owner.displayName}`;
  const description = data.project.shortDescription;
  const url = `/p/${data.owner.username}/projects/${data.project.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article", siteName: siteConfig.name },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicProjectPage({
  params,
}: PageProps<"/p/[username]/projects/[projectSlug]">) {
  await connection();
  const { username, projectSlug } = await params;
  const data = await loadPublicProject(username, projectSlug);
  if (!data) notFound();
  const { owner, project } = data;
  const range = formatRange(project.startDate, project.endDate);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={`/p/${owner.username}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {owner.displayName}&apos;s portfolio
      </Link>
      <header className="mt-4 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight break-words">{project.title}</h1>
        <p className="text-lg break-words text-muted-foreground">{project.shortDescription}</p>
        <p className="text-sm text-muted-foreground">
          {[PROJECT_STATUS_LABELS[project.status], project.role, range].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap gap-x-4">
          <SafeLink href={project.repositoryUrl}>Code repository</SafeLink>
          <SafeLink href={project.liveUrl}>Live demo</SafeLink>
        </div>
      </header>

      {(project.skills.length > 0 || project.technologies.length > 0) && (
        <section aria-labelledby="stack-heading" className="mt-8">
          <h2 id="stack-heading" className="mb-3 text-lg font-semibold">
            Skills & technologies
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {[...new Set([...project.skills.map((s) => s.name), ...project.technologies])].map(
              (t) => (
                <li key={t}>
                  <Badge variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {project.description && (
        <section aria-labelledby="about-project-heading" className="mt-8">
          <h2 id="about-project-heading" className="mb-3 text-lg font-semibold">
            About this project
          </h2>
          <p className="leading-relaxed break-words whitespace-pre-line">{project.description}</p>
        </section>
      )}

      {project.evidence.length > 0 && (
        <section aria-labelledby="links-heading" className="mt-8">
          <h2 id="links-heading" className="mb-1 text-lg font-semibold">
            Evidence links
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Provided by {owner.displayName}.</p>
          <ul className="grid gap-2">
            {project.evidence.map((e, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{EVIDENCE_KIND_LABELS[e.kind]}</p>
                <SafeLink href={e.url} className="break-all">
                  {e.label || e.url}
                </SafeLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
