import { CircleAlert, CircleCheck, CircleDashed, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AnalysisStatusValue = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

const config = {
  NONE: { label: "Not analyzed", icon: CircleDashed, className: "text-muted-foreground" },
  PENDING: { label: "Queued", icon: Loader2, className: "text-brand" },
  PROCESSING: { label: "Analyzing", icon: Loader2, className: "text-brand" },
  COMPLETED: { label: "Completed", icon: CircleCheck, className: "text-success" },
  FAILED: { label: "Failed", icon: CircleAlert, className: "text-destructive" },
} as const;

export function isActiveStatus(status: AnalysisStatusValue | null | undefined) {
  return status === "PENDING" || status === "PROCESSING";
}

export function AnalysisStatusBadge({
  status,
  className,
}: {
  status: AnalysisStatusValue | null | undefined;
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = config[status ?? "NONE"];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <Icon className={cn("size-3", tone, isActiveStatus(status) && "animate-spin")} aria-hidden />
      {label}
    </Badge>
  );
}
