import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PublicSkillCard } from "@/components/public-portfolio/skill-card";
import { CopyLinkButton } from "@/components/portfolio/share";
import { siteConfig } from "@/lib/config/site";
import { loadPublicPortfolio } from "@/lib/data/public-cache";

export async function generateMetadata({
  params,
}: PageProps<"/p/[username]/skills">): Promise<Metadata> {
  await connection();
  const { username } = await params;
  const data = await loadPublicPortfolio(username);
  if (!data || data.skills.length === 0)
    return { title: "Skill Passport not available", robots: { index: false } };
  const title = `${data.displayName} — Skill Passport`;
  const description = `Skills and supporting evidence for ${data.displayName}.`;
  const url = `/p/${data.username}/skills`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "profile", siteName: siteConfig.name },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicSkillsPage({ params }: PageProps<"/p/[username]/skills">) {
  await connection();
  const { username } = await params;
  const data = await loadPublicPortfolio(username);
  if (!data || data.skills.length === 0) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={`/p/${data.username}`}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {data.displayName}&apos;s portfolio
      </Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight break-words">Skill Passport</h1>
          <p className="max-w-2xl text-muted-foreground">
            {data.displayName}&apos;s skills. Levels are self-assessed; evidence strength is
            calculated by SkillForge AI from linked projects, certifications
            {data.skills.some((s) => s.assessment) ? ", assessments" : ""}
            {data.skills.some((s) => s.interviewAnswers > 0) ? " and interview practice" : ""}.
          </p>
        </div>
        <CopyLinkButton path={`/p/${data.username}/skills`} label="Copy link" />
      </div>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {data.skills.map((s) => (
          <li key={s.name}>
            <PublicSkillCard skill={s} username={data.username} detailed />
          </li>
        ))}
      </ul>
    </div>
  );
}
