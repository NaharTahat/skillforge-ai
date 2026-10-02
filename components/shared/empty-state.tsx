import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** Heading level for the title; use "h2" when it sits directly under the page's h1. */
  titleAs?: "h2" | "h3";
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-12 place-items-center rounded-xl border bg-muted/50">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <Title className="text-base font-medium">{title}</Title>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
