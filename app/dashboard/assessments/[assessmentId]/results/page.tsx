import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AssessmentHeader } from "@/components/assessment/assessment-header";
import { AssessmentResults } from "@/components/assessment/assessment-results";
import { getMyAssessmentResult } from "@/lib/data/assessment";

export const metadata: Metadata = { title: "Assessment results" };

export default async function AssessmentResultsPage({
  params,
}: PageProps<"/dashboard/assessments/[assessmentId]/results">) {
  const { assessmentId } = await params;
  // Ownership is part of the query; results (with answer keys) exist only once the assessment is finished.
  const data = await getMyAssessmentResult(assessmentId);
  if (!data) notFound();
  if (!data.finished) redirect(`/dashboard/assessments/${data.id}`);

  return (
    <div className="space-y-6">
      <AssessmentHeader a={data.assessment} showPracticeAgain />
      <AssessmentResults data={data} />
      <p className="text-xs text-muted-foreground">
        All your assessments are in{" "}
        <Link
          href="/dashboard/assessments/history"
          className="inline-block rounded-sm py-1.5 text-brand hover:underline"
        >
          Assessment history
        </Link>
        .
      </p>
    </div>
  );
}
