"use client";

import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ConfirmDeleteButtonProps = {
  /** Accessible name of the trigger, e.g. "Delete resume.pdf". */
  triggerLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  successMessage: string;
  onConfirm: () => Promise<{ ok: true } | { ok: false; error?: string }>;
  /** Where to go after deleting; otherwise the current page is refreshed. */
  redirectTo?: string;
  size?: "sm" | "default";
  className?: string;
};

export function ConfirmDeleteButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  successMessage,
  onConfirm,
  redirectTo,
  size = "default",
  className,
}: ConfirmDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setOpen(false);
      toast.success(successMessage);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={cn("text-muted-foreground hover:text-destructive", className)}
          aria-label={triggerLabel}
        >
          <Trash2 />
          <span className="sr-only sm:not-sr-only">Delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="h-10 md:h-9" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            className="h-10 md:h-9"
            disabled={pending}
            onClick={confirm}
          >
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
