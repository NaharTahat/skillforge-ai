"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteAssessmentAction, practiceAgainAction } from "@/app/dashboard/assessments/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Button } from "@/components/ui/button";

type ButtonSize = "sm" | "default";

export function PracticeAgainButton({
  assessmentId,
  label,
  size = "default",
  className,
}: {
  assessmentId: string;
  label: string;
  size?: ButtonSize;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size={size}
      className={className}
      disabled={pending}
      aria-label={`Practice again: ${label}`}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await practiceAgainAction(assessmentId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push(`/dashboard/assessments/${result.assessmentId}`);
          } catch {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Practice again
    </Button>
  );
}

export function DeleteAssessmentButton({
  assessmentId,
  label,
  size = "default",
  redirectTo,
  className,
}: {
  assessmentId: string;
  label: string;
  size?: ButtonSize;
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${label}`}
      title="Delete this assessment?"
      description={
        <>
          <span className="font-medium break-all text-foreground">{label}</span>, its questions,
          your answers and the results will be permanently deleted. Your CV, job matches, roadmaps
          and interviews are not affected.
        </>
      }
      confirmLabel="Delete assessment"
      successMessage="Assessment deleted"
      onConfirm={() => deleteAssessmentAction(assessmentId)}
      redirectTo={redirectTo}
      size={size}
      className={className}
    />
  );
}
