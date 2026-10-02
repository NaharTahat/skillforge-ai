"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteInterviewAction, practiceAgainAction } from "@/app/dashboard/interview/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Button } from "@/components/ui/button";

type ButtonSize = "sm" | "default";

export function PracticeAgainButton({
  interviewId,
  label,
  size = "default",
  className,
}: {
  interviewId: string;
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
            const result = await practiceAgainAction(interviewId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push(`/dashboard/interview/${result.interviewId}`);
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

export function DeleteInterviewButton({
  interviewId,
  label,
  size = "default",
  redirectTo,
  className,
}: {
  interviewId: string;
  label: string;
  size?: ButtonSize;
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${label}`}
      title="Delete this interview?"
      description={
        <>
          <span className="font-medium break-all text-foreground">{label}</span>, its questions,
          your answers and the report will be permanently deleted. Your CV, job matches and roadmaps
          are not affected.
        </>
      }
      confirmLabel="Delete interview"
      successMessage="Interview deleted"
      onConfirm={() => deleteInterviewAction(interviewId)}
      redirectTo={redirectTo}
      size={size}
      className={className}
    />
  );
}
