import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FileSearch } from "lucide-react";
import { AssessmentHistory } from "@/components/assessment/assessment-history";
import { CreateAssessmentForm } from "@/components/assessment/create-assessment";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getAssessmentSources, listMyAssessments } from "@/lib/data/assessment";
import { assessmentErrorMessage } from "@/lib/assessment/errors";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const [sources, recent] = await Promise.all([getAssessmentSources(), listMyAssessments(5)]);
  const ready = sources.analyzedCvs.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Assessments"
        description="Find out what you actually know, where you're weak, and what to practice next."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {!ready ? (
            <EmptyState
              icon={FileSearch}
              titleAs="h2"
              title={assessmentErrorMessage(sources.hasCv ? "CV_NOT_ANALYZED" : "NO_CV")}
              description={
                sources.hasCv
                  ? "Assessments use your CV analysis to choose skills and set an adaptive difficulty. Finish or re-run the analysis in the CV Analyzer."
                  : "Assessments are built around your own skills. Upload a CV in the CV Analyzer to get started."
              }
              action={
                <Button asChild>
                  <Link href="/dashboard/cv">Go to CV Analyzer</Link>
                </Button>
              }
            />
          ) : (
            <CreateAssessmentForm sources={sources} />
          )}
        </div>

        <section aria-labelledby="recent-assessments-heading" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="recent-assessments-heading" className="font-medium">
              Recent assessments
            </h2>
            <Link
              href="/dashboard/assessments/history"
              className="rounded-sm py-1.5 text-sm text-brand hover:underline"
            >
              View history
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No assessments yet"
              description="Your assessments will appear here, so you can review results, practice again or delete them."
              className="py-10"
            />
          ) : (
            <AssessmentHistory assessments={recent} />
          )}
        </section>
      </div>
    </div>
  );
}
