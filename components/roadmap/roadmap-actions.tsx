"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteRoadmapAction, regenerateRoadmapAction } from "@/app/dashboard/roadmap/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Button } from "@/components/ui/button";

type ButtonSize = "sm" | "default";

export function RegenerateRoadmapButton({
  roadmapId,
  label,
  size = "default",
  className,
}: {
  roadmapId: string;
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
      aria-label={`Re-generate ${label}`}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await regenerateRoadmapAction(roadmapId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push(`/dashboard/roadmap/${result.roadmapId}`);
          } catch {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Re-generate
    </Button>
  );
}

export function DeleteRoadmapButton({
  roadmapId,
  label,
  size = "default",
  redirectTo,
  className,
}: {
  roadmapId: string;
  label: string;
  size?: ButtonSize;
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${label}`}
      title="Delete this roadmap?"
      description={
        <>
          <span className="font-medium break-all text-foreground">{label}</span> and its task
          progress will be permanently deleted. Your CV, job matches and other roadmaps are not
          affected.
        </>
      }
      confirmLabel="Delete roadmap"
      successMessage="Roadmap deleted"
      onConfirm={() => deleteRoadmapAction(roadmapId)}
      redirectTo={redirectTo}
      size={size}
      className={className}
    />
  );
}
