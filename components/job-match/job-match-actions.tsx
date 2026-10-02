"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteJobMatchAction, reanalyzeJobMatchAction } from "@/app/dashboard/job-match/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Button } from "@/components/ui/button";

type ButtonSize = "sm" | "default";

export function ReanalyzeJobButton({
  jobId,
  jobLabel,
  size = "default",
  className,
}: {
  jobId: string;
  jobLabel: string;
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
      aria-label={`Re-analyze ${jobLabel}`}
      onClick={() =>
        startTransition(async () => {
          const result = await reanalyzeJobMatchAction(jobId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push(`/dashboard/job-match/${jobId}?analysis=${result.analysisId}`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Re-analyze
    </Button>
  );
}

export function DeleteJobMatchButton({
  jobId,
  jobLabel,
  size = "default",
  redirectTo,
  className,
}: {
  jobId: string;
  jobLabel: string;
  size?: ButtonSize;
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${jobLabel}`}
      title="Delete this job match?"
      description={
        <>
          <span className="font-medium break-all text-foreground">{jobLabel}</span>, its job
          description and all of its match reports will be permanently deleted. Your CV is not
          affected.
        </>
      }
      confirmLabel="Delete match"
      successMessage="Job match deleted"
      onConfirm={() => deleteJobMatchAction(jobId)}
      redirectTo={redirectTo}
      size={size}
      className={className}
    />
  );
}
