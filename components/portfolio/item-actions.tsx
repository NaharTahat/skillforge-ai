"use client";

import { useRouter } from "next/navigation";
import { Eye, EyeOff, Globe, Loader2, Lock } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteItemAction, setVisibilityAction } from "@/app/dashboard/portfolio/actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Visibility } from "@/lib/portfolio/constants";
import type { ItemKind } from "@/lib/portfolio/validation";
import { cn } from "@/lib/utils";

export function VisibilityBadge({
  visibility,
  className,
}: {
  visibility: Visibility;
  className?: string;
}) {
  const Icon = visibility === "PUBLIC" ? Globe : Lock;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      <Icon
        className={cn("size-3", visibility === "PUBLIC" ? "text-success" : "text-muted-foreground")}
        aria-hidden
      />
      {visibility === "PUBLIC" ? "Public" : "Private"}
    </Badge>
  );
}

export function VisibilityToggle({
  kind,
  id,
  visibility,
  label,
}: {
  kind: ItemKind;
  id: string;
  visibility: Visibility;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Visibility = visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 sm:h-8"
      disabled={pending}
      aria-label={`${next === "PUBLIC" ? "Make public" : "Make private"}: ${label}`}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await setVisibilityAction({ kind, id, visibility: next });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(next === "PUBLIC" ? "Now public" : "Now private");
            router.refresh();
          } catch {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : next === "PUBLIC" ? <Eye /> : <EyeOff />}
      {next === "PUBLIC" ? "Make public" : "Make private"}
    </Button>
  );
}

export function DeleteItemButton({
  kind,
  id,
  label,
  what,
  redirectTo,
  className,
}: {
  kind: ItemKind;
  id: string;
  label: string;
  what: string;
  redirectTo?: string;
  className?: string;
}) {
  return (
    <ConfirmDeleteButton
      triggerLabel={`Delete ${label}`}
      title={`Delete this ${what}?`}
      description={
        <>
          <span className="font-medium break-all text-foreground">{label}</span> will be permanently
          deleted.
        </>
      }
      confirmLabel={`Delete ${what}`}
      successMessage={`${what[0]!.toUpperCase()}${what.slice(1)} deleted`}
      onConfirm={() => deleteItemAction({ kind, id })}
      redirectTo={redirectTo}
      size="sm"
      className={cn("h-9 sm:h-8", className)}
    />
  );
}
