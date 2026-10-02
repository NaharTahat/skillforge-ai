import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AssessmentGenerationProgress } from "@/components/assessment/assessment-generation-progress";
import { AssessmentHeader } from "@/components/assessment/assessment-header";
import {
  AssessmentRunner,
  AssessmentStart,
  AssessmentTimeUp,
} from "@/components/assessment/assessment-runner";
import { ErrorState } from "@/components/shared/error-state";
import { getMyAssessment } from "@/lib/data/assessment";
import { assessmentErrorMessage } from "@/lib/assessment/errors";

export const metadata: Metadata = { title: "Assessment" };

export default async function AssessmentPage({
  params,
}: PageProps<"/dashboard/assessments/[assessmentId]">) {
  const { assessmentId } = await params;

  // Ownership is part of the query: another user's assessment looks exactly like a missing one.
  const assessment = await getMyAssessment(assessmentId);
  if (!assessment) notFound();
  if (assessment.status === "COMPLETED" || assessment.status === "EXPIRED") {
    redirect(`/dashboard/assessments/${assessment.id}/results`);
  }

  const generating = assessment.status === "DRAFT" || assessment.status === "GENERATING";
  return (
    <div className="space-y-6">
      <AssessmentHeader a={assessment} showPracticeAgain={!generating} />
      {generating ? (
        <AssessmentGenerationProgress
          assessmentId={assessment.id}
          initialStage={assessment.stage}
          queued={assessment.status === "DRAFT"}
        />
      ) : assessment.status === "FAILED" ? (
        <ErrorState
          title="This assessment couldn't be prepared"
          description={`${assessmentErrorMessage(assessment.errorCode)} Use “Practice again” to try once more.`}
        />
      ) : assessment.timeUp ? (
        <AssessmentTimeUp assessmentId={assessment.id} />
      ) : !assessment.startedAt ? (
        <AssessmentStart assessment={assessment} />
      ) : (
        <AssessmentRunner assessment={assessment} />
      )}
    </div>
  );
}
