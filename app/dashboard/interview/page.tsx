import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch, MessagesSquare } from "lucide-react";
import { CreateInterviewForm } from "@/components/interview/create-interview";
import { InterviewHistory } from "@/components/interview/interview-history";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getInterviewSources, listMyInterviews } from "@/lib/data/interview";
import { interviewErrorMessage } from "@/lib/interview/errors";

export const metadata: Metadata = { title: "AI Interview" };

export default async function InterviewPage() {
  const [sources, interviews] = await Promise.all([getInterviewSources(), listMyInterviews()]);
  const ready = sources.analyzedCvs.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Interview"
        description="Practice a realistic interview built from your CV, job matches and career goal."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {!ready ? (
            <EmptyState
              icon={FileSearch}
              titleAs="h2"
              title={interviewErrorMessage(sources.hasCv ? "CV_NOT_ANALYZED" : "NO_CV")}
              description={
                sources.hasCv
                  ? "Interview questions are grounded in a completed CV analysis. Open the CV Analyzer to finish or re-run it."
                  : "Interview questions are generated from your own CV. Upload and analyze a CV, then come back here."
              }
              action={
                <Button asChild>
                  <Link href="/dashboard/cv">Go to CV Analyzer</Link>
                </Button>
              }
            />
          ) : (
            <CreateInterviewForm sources={sources} />
          )}
        </div>

        <section aria-labelledby="interview-history-heading" className="min-w-0">
          <h2 id="interview-history-heading" className="mb-3 font-medium">
            Your interviews
          </h2>
          {interviews.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No interviews yet"
              description="Your interviews will appear here, so you can reopen, practice again or delete them."
              className="py-10"
            />
          ) : (
            <InterviewHistory interviews={interviews} />
          )}
        </section>
      </div>
    </div>
  );
}
