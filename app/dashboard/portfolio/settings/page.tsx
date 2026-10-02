import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { QrCode } from "@/components/portfolio/qr-code";
import { SettingsForm } from "@/components/portfolio/settings-form";
import { CopyLinkButton } from "@/components/portfolio/share";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { getMySettings } from "@/lib/data/portfolio";

export const metadata: Metadata = { title: "Public settings" };

export default async function PortfolioSettingsPage() {
  const { username, passport } = await getMySettings();
  const isPublic = Boolean(passport?.isPublic && username);
  const path = username ? `/p/${username}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public settings"
        description="Choose your username, what's visible and whether your portfolio is public."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SettingsForm
          initial={{
            username: username ?? "",
            isPublic: passport?.isPublic ?? false,
            showAbout: passport?.showAbout ?? true,
            showProjects: passport?.showProjects ?? true,
            showSkills: passport?.showSkills ?? true,
            showEducation: passport?.showEducation ?? true,
            showCertifications: passport?.showCertifications ?? true,
            showAchievements: passport?.showAchievements ?? true,
            showExperience: passport?.showExperience ?? true,
            showLinks: passport?.showLinks ?? true,
            showAssessments: passport?.showAssessments ?? true,
            showInterviewScore: passport?.showInterviewScore ?? false,
          }}
        />
        <section aria-labelledby="share-heading" className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 id="share-heading" className="mb-3 font-medium">
            Share
          </h2>
          {isPublic && path ? (
            <div className="space-y-4">
              <p className="text-sm break-all text-muted-foreground" data-testid="public-url">
                {siteConfig.url.replace(/\/$/, "")}
                {path}
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyLinkButton path={path} />
                <CopyLinkButton path={`${path}/skills`} label="Share Skill Passport" />
                <Button asChild variant="outline" className="h-10 md:h-9">
                  <Link href={path} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    View
                  </Link>
                </Button>
              </div>
              <QrCode
                url={`${siteConfig.url.replace(/\/$/, "")}${path}`}
                label="QR code linking to your public portfolio"
              />
              <p className="text-xs text-muted-foreground">
                The QR code only contains your public portfolio address.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your portfolio is private. Choose a username and turn on &ldquo;Make my portfolio
              public&rdquo; to get a link and QR code.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
