import { CircleAlert, CircleCheck, CirclePlay, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type AssessmentStatus } from "@/lib/assessment/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<AssessmentStatus, { icon: typeof CircleCheck; tone: string; spin?: boolean }> =
  {
    DRAFT: { icon: Loader2, tone: "text-brand", spin: true },
    GENERATING: { icon: Loader2, tone: "text-brand", spin: true },
    IN_PROGRESS: { icon: CirclePlay, tone: "text-brand" },
    COMPLETED: { icon: CircleCheck, tone: "text-success" },
    EXPIRED: { icon: Clock, tone: "text-warning" },
    FAILED: { icon: CircleAlert, tone: "text-destructive" },
  };

export function AssessmentStatusBadge({
  status,
  className,
}: {
  status: AssessmentStatus;
  className?: string;
}) {
  const { icon: Icon, tone, spin } = ICONS[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <Icon className={cn("size-3", tone, spin && "animate-spin")} aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
