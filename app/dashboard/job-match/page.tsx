import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, FileSearch } from "lucide-react";
import { JobMatchForm } from "@/components/job-match/job-match-form";
import { JobMatchHistory } from "@/components/job-match/job-match-history";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listMyAnalyzedCvs, listMyJobMatches } from "@/lib/data/job-match";

export const metadata: Metadata = { title: "AI Job Match" };

export default async function JobMatchPage() {
  const [cvs, matches] = await Promise.all([listMyAnalyzedCvs(), listMyJobMatches()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Job Match"
        description="See how closely your CV aligns with a specific role."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {cvs.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            titleAs="h2"
            title="Analyze your CV first to unlock Job Match."
            description="Job Match compares a job description with an analyzed CV. Upload and analyze a CV, then come back here."
            action={
              <Button asChild>
                <Link href="/dashboard/cv">Go to CV Analyzer</Link>
              </Button>
            }
          />
        ) : (
          <JobMatchForm cvs={cvs} />
        )}

        <section aria-labelledby="match-history-heading" className="min-w-0">
          <h2 id="match-history-heading" className="mb-3 font-medium">
            Match history
          </h2>
          {matches.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No job matches yet"
              description="Your saved matches will appear here, so you can reopen, re-run or delete them."
              className="py-10"
            />
          ) : (
            <JobMatchHistory matches={matches} />
          )}
        </section>
      </div>
    </div>
  );
}
