import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AssessmentHistory } from "@/components/assessment/assessment-history";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { listMyAssessments } from "@/lib/data/assessment";

export const metadata: Metadata = { title: "Assessment history" };

export default async function AssessmentHistoryPage() {
  const assessments = await listMyAssessments();
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/assessments"
        className="-my-2 inline-flex items-center gap-1.5 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Assessments
      </Link>
      <PageHeader
        title="Assessment history"
        description="Every assessment you've taken, with its score and status."
      />
      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          titleAs="h2"
          title="No assessments yet"
          description="Create your first assessment to see your results here."
          action={
            <Button asChild>
              <Link href="/dashboard/assessments">Create an assessment</Link>
            </Button>
          }
        />
      ) : (
        <section aria-label="All assessments" className="min-w-0">
          <AssessmentHistory assessments={assessments} />
        </section>
      )}
    </div>
  );
}
