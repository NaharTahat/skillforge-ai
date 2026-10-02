"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { analyzeCvAction, deleteCvAction } from "@/app/dashboard/cv/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Button } from "@/components/ui/button";

type ButtonSize = "sm" | "default";

export function AnalyzeCvButton({
  cvId,
  label,
  variant = "outline",
  size = "default",
  className,
}: {
  cvId: string;
  label: "Analyze" | "Re-analyze";
  variant?: "default" | "outline";
  size?: ButtonSize;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await analyzeCvAction(cvId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.push(`/dashboard/cv/${cvId}?analysis=${result.analysisId}`);
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : label === "Analyze" ? (
        <Sparkles />
      ) : (
        <RotateCcw />
      )}
      {label}
    </Button>
  );
}

export function DeleteCvButton({
  cvId,
  fileName,
  size = "default",
  redirectTo,
  className,
}: {
  cvId: string;
  fileName: string;
  size?: ButtonSize;
  /** Where to go after deleting (e.g. back to the list from a detail page). */
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${fileName}`}
      title="Delete this CV?"
      description={
        <>
          <span className="font-medium break-all text-foreground">{fileName}</span>, its stored file
          and all of its analyses will be permanently deleted. This can&apos;t be undone.
        </>
      }
      confirmLabel="Delete CV"
      successMessage="CV deleted"
      onConfirm={() => deleteCvAction(cvId)}
      redirectTo={redirectTo}
      size={size}
      className={className}
    />
  );
}
