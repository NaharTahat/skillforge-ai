import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { formatMonth, formatRange } from "@/components/portfolio/format";
import { CopyLinkButton } from "@/components/portfolio/share";
import { PublicSection, SafeLink } from "@/components/public-portfolio/public-shell";
import { PublicSkillCard } from "@/components/public-portfolio/skill-card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/config/site";
import { loadPublicPortfolio } from "@/lib/data/public-cache";
import {
  ACHIEVEMENT_KIND_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/portfolio/constants";

export async function generateMetadata({ params }: PageProps<"/p/[username]">): Promise<Metadata> {
  await connection();
  const { username } = await params;
  const data = await loadPublicPortfolio(username);
  if (!data) return { title: "Portfolio not available", robots: { index: false } };
  const title = `${data.displayName} — Portfolio`;
  const description =
    data.headline ?? `${data.displayName}'s projects and skills on ${siteConfig.name}.`;
  const url = `/p/${data.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile", siteName: siteConfig.name },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicPortfolioPage({ params }: PageProps<"/p/[username]">) {
  await connection();
  const { username } = await params;
  const data = await loadPublicPortfolio(username);
  if (!data) notFound();

  const hasLinks = data.links && (data.links.website || data.links.github || data.links.linkedin);
  const nav = [
    data.projects.length && { id: "projects", label: "Projects" },
    data.skills.length && { id: "skills", label: "Skills" },
    data.experiences.length && { id: "experience", label: "Experience" },
    data.educations.length && { id: "education", label: "Education" },
    data.certifications.length && { id: "certifications", label: "Certifications" },
    data.achievements.length && { id: "achievements", label: "Achievements" },
  ].filter((x): x is { id: string; label: string } => Boolean(x));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <UserAvatar name={data.displayName} image={data.image} className="size-20 sm:size-24" />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">
            {data.displayName}
          </h1>
          {data.headline && (
            <p className="text-lg break-words text-muted-foreground">{data.headline}</p>
          )}
          {data.about?.location && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {data.about.location}
            </p>
          )}
          {hasLinks && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Links">
              {data.links?.website && (
                <li>
                  <SafeLink href={data.links.website}>Website</SafeLink>
                </li>
              )}
              {data.links?.github && (
                <li>
                  <SafeLink href={data.links.github}>GitHub</SafeLink>
                </li>
              )}
              {data.links?.linkedin && (
                <li>
                  <SafeLink href={data.links.linkedin}>LinkedIn</SafeLink>
                </li>
              )}
            </ul>
          )}
        </div>
        <CopyLinkButton path={`/p/${data.username}`} label="Copy link" />
      </header>

      {nav.length > 1 && (
        <nav aria-label="Portfolio sections" className="mt-8 overflow-x-auto">
          <ul className="flex min-w-max gap-1 border-b">
            {nav.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="inline-flex min-h-10 items-center px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-10 space-y-12">
        {data.about?.bio && (
          <PublicSection id="about" title="About">
            <p className="max-w-3xl leading-relaxed break-words whitespace-pre-line">
              {data.about.bio}
            </p>
          </PublicSection>
        )}

        {data.projects.length > 0 && (
          <PublicSection id="projects" title="Projects">
            <ul className="grid gap-4 md:grid-cols-2">
              {data.projects.map((p) => (
                <li key={p.slug}>
                  <article
                    className="flex h-full flex-col rounded-xl border bg-card p-5"
                    data-testid="public-project"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium break-words">
                        <Link
                          href={`/p/${data.username}/projects/${p.slug}`}
                          className="rounded-sm hover:underline"
                        >
                          {p.title}
                        </Link>
                      </h3>
                      {p.featured && (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Star className="size-3 fill-current text-amber-500" aria-hidden />
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PROJECT_STATUS_LABELS[p.status]}
                    </p>
                    <p className="mt-2 text-sm break-words text-muted-foreground">
                      {p.shortDescription}
                    </p>
                    {(p.technologies.length > 0 || p.skills.length > 0) && (
                      <ul
                        className="mt-3 flex flex-wrap gap-1.5"
                        aria-label="Technologies and skills"
                      >
                        {[...new Set([...p.skills.map((s) => s.name), ...p.technologies])]
                          .slice(0, 10)
                          .map((t) => (
                            <li key={t}>
                              <Badge variant="secondary" className="font-normal">
                                {t}
                              </Badge>
                            </li>
                          ))}
                      </ul>
                    )}
                    <div className="mt-auto flex flex-wrap gap-x-4 pt-4">
                      <Link
                        href={`/p/${data.username}/projects/${p.slug}`}
                        className="inline-flex min-h-10 items-center gap-1 text-sm text-brand hover:underline sm:min-h-0"
                        aria-label={`Project details: ${p.title}`}
                      >
                        Details
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                      <SafeLink href={p.repositoryUrl}>Code</SafeLink>
                      <SafeLink href={p.liveUrl}>Live demo</SafeLink>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </PublicSection>
        )}

        {data.skills.length > 0 && (
          <PublicSection id="skills" title="Skills">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.skills.map((s) => (
                <li key={s.name}>
                  <PublicSkillCard skill={s} username={data.username} />
                </li>
              ))}
            </ul>
            <Link
              href={`/p/${data.username}/skills`}
              className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm text-brand hover:underline"
            >
              View Skill Passport with evidence
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </PublicSection>
        )}

        {data.experiences.length > 0 && (
          <PublicSection id="experience" title="Experience">
            <ol className="grid gap-4">
              {data.experiences.map((e, i) => (
                <li key={i} className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium break-words">{e.title}</h3>
                  <p className="text-sm break-words text-muted-foreground">
                    {[
                      e.company,
                      e.employmentType && EMPLOYMENT_TYPE_LABELS[e.employmentType],
                      e.location,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {formatRange(e.startDate, e.endDate) && (
                    <p className="text-xs text-muted-foreground">
                      {formatRange(e.startDate, e.endDate)}
                    </p>
                  )}
                  {e.description && (
                    <p className="mt-2 text-sm break-words whitespace-pre-line">{e.description}</p>
                  )}
                </li>
              ))}
            </ol>
          </PublicSection>
        )}

        {data.educations.length > 0 && (
          <PublicSection id="education" title="Education">
            <ol className="grid gap-4">
              {data.educations.map((e, i) => (
                <li key={i} className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium break-words">{e.institution}</h3>
                  {(e.degree || e.field) && (
                    <p className="text-sm break-words text-muted-foreground">
                      {[e.degree, e.field].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[formatRange(e.startDate, e.endDate), e.grade && `Grade: ${e.grade}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {e.description && (
                    <p className="mt-2 text-sm break-words whitespace-pre-line">{e.description}</p>
                  )}
                </li>
              ))}
            </ol>
          </PublicSection>
        )}

        {data.certifications.length > 0 && (
          <PublicSection id="certifications" title="Certifications">
            <p className="-mt-2 mb-4 text-xs text-muted-foreground">
              Provided by {data.displayName}; not verified by SkillForge AI.
            </p>
            <ul className="grid gap-4 md:grid-cols-2">
              {data.certifications.map((c, i) => (
                <li key={i} className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium break-words">{c.name}</h3>
                  <p className="text-sm break-words text-muted-foreground">{c.issuer}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      c.issueDate && `Issued ${formatMonth(c.issueDate)}`,
                      c.expirationDate && `Expires ${formatMonth(c.expirationDate)}`,
                      c.credentialId && `ID ${c.credentialId}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {c.description && <p className="mt-2 text-sm break-words">{c.description}</p>}
                  <SafeLink href={c.credentialUrl} className="mt-2">
                    Credential link
                  </SafeLink>
                </li>
              ))}
            </ul>
          </PublicSection>
        )}

        {data.achievements.length > 0 && (
          <PublicSection id="achievements" title="Achievements">
            <ul className="grid gap-4 md:grid-cols-2">
              {data.achievements.map((a, i) => (
                <li key={i} className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium break-words">{a.title}</h3>
                  <p className="text-sm break-words text-muted-foreground">
                    {[ACHIEVEMENT_KIND_LABELS[a.kind], a.issuer, a.date && formatMonth(a.date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {a.description && <p className="mt-2 text-sm break-words">{a.description}</p>}
                  <SafeLink href={a.url} className="mt-2">
                    Link
                  </SafeLink>
                </li>
              ))}
            </ul>
          </PublicSection>
        )}

        {!data.about?.bio && nav.length === 0 && (
          <p className="text-muted-foreground">Nothing has been shared here yet.</p>
        )}
      </div>
    </div>
  );
}
