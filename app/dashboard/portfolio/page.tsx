import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, ExternalLink, Globe, Lock, Plus } from "lucide-react";
import { CopyLinkButton } from "@/components/portfolio/share";
import { PageHeader } from "@/components/shared/page-header";
import { ReadinessRing } from "@/components/shared/readiness-ring";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPortfolioOverview } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const data = await getPortfolioOverview();
  const { stats, completion } = data;
  const publicPath = data.username ? `/p/${data.username}` : null;
  const empty =
    stats.projects === 0 && stats.skills === 0 && !data.profile?.headline && !data.profile?.bio;

  const statItems = [
    {
      label: "Projects",
      value: stats.projects,
      sub: `${stats.publicProjects} public`,
      href: "/dashboard/portfolio/projects",
    },
    { label: "Skills", value: stats.skills, href: "/dashboard/portfolio/skills" },
    {
      label: "Certifications",
      value: stats.certifications,
      href: "/dashboard/portfolio/edit#certifications",
    },
    {
      label: "Assessments completed",
      value: stats.assessments,
      href: "/dashboard/assessments/history",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio"
        description="Show what you've built and the evidence behind your skills. Everything is private until you choose to publish it."
        actions={
          <Button asChild className="h-10 md:h-9">
            <Link href="/dashboard/portfolio/projects/new">
              <Plus />
              Add project
            </Link>
          </Button>
        }
      />

      {empty && (
        <p
          role="status"
          className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground"
          data-testid="portfolio-empty"
        >
          Your portfolio is empty. Start with a headline and your first project — the checklist
          below shows what to add next.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="portfolio-identity"
            className="rounded-xl border bg-card p-4 sm:p-6"
          >
            <h2 id="portfolio-identity" className="sr-only">
              Profile summary
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <UserAvatar name={data.displayName ?? "You"} image={data.image} className="size-16" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-lg font-semibold break-words">
                  {data.displayName ?? "Add your name in Profile"}
                </p>
                <p className="break-words text-muted-foreground" data-testid="portfolio-headline">
                  {data.profile?.headline || "No headline yet"}
                </p>
                {data.profile?.bio && (
                  <p className="line-clamp-3 text-sm break-words text-muted-foreground">
                    {data.profile.bio}
                  </p>
                )}
                {data.mainSkills.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Main skills">
                    {data.mainSkills.map((s) => (
                      <li key={s}>
                        <Badge variant="secondary">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button asChild variant="outline" className="h-10 self-start md:h-9">
                <Link href="/dashboard/portfolio/edit">Edit profile</Link>
              </Button>
            </div>
          </section>

          <section aria-labelledby="portfolio-stats">
            <h2 id="portfolio-stats" className="mb-3 font-medium">
              At a glance
            </h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {statItems.map((s) => (
                <li key={s.label}>
                  <Link
                    href={s.href}
                    className="block h-full rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="block text-2xl font-semibold tabular-nums">{s.value}</span>
                    <span className="block text-sm text-muted-foreground">{s.label}</span>
                    {s.sub && <span className="block text-xs text-muted-foreground">{s.sub}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Counts come from your own records. Nothing here is estimated.
            </p>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section
            aria-labelledby="portfolio-public"
            className="rounded-xl border bg-card p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="portfolio-public" className="font-medium">
                Public portfolio
              </h2>
              <Badge variant="outline" className="gap-1" data-testid="portfolio-public-status">
                {data.isPublic ? (
                  <Globe className="size-3 text-success" aria-hidden />
                ) : (
                  <Lock className="size-3" aria-hidden />
                )}
                {data.isPublic ? "Public" : "Private"}
              </Badge>
            </div>
            {data.isPublic && publicPath ? (
              <div className="space-y-3">
                <p className="text-sm break-all text-muted-foreground">{publicPath}</p>
                <div className="flex flex-wrap gap-2">
                  <CopyLinkButton path={publicPath} />
                  <Button asChild variant="outline" className="h-10 md:h-9">
                    <Link href={publicPath} target="_blank" rel="noopener noreferrer">
                      <ExternalLink />
                      View public page
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Only you can see your portfolio. Choose a username and turn on your public page
                  when you&apos;re ready.
                </p>
                <Button asChild variant="outline" className="h-10 md:h-9">
                  <Link href="/dashboard/portfolio/settings">Public settings</Link>
                </Button>
              </div>
            )}
          </section>

          <section
            aria-labelledby="portfolio-completion"
            className="rounded-xl border bg-card p-4 sm:p-6"
          >
            <h2 id="portfolio-completion" className="mb-4 font-medium">
              Portfolio completion
            </h2>
            <div className="flex items-center gap-4">
              <ReadinessRing value={completion.percent} size={88} label="Portfolio completion" />
              <p className="text-sm text-muted-foreground">
                {completion.completed} of {completion.total} steps done. Each step counts equally.
              </p>
            </div>
            {completion.todo.length > 0 ? (
              <ul className="mt-4 grid gap-1" aria-label="Next steps">
                {completion.todo.map((t) => (
                  <li key={t.key}>
                    <Link
                      href={t.href}
                      className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="flex-1">{t.label}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                Every step is complete.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
