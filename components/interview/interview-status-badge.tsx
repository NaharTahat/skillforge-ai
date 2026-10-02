import { CircleAlert, CircleCheck, CirclePlay, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { INTERVIEW_STATUS_LABELS, type InterviewStatus } from "@/lib/interview/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<InterviewStatus, { icon: typeof CircleCheck; tone: string; spin?: boolean }> = {
  DRAFT: { icon: Loader2, tone: "text-brand", spin: true },
  GENERATING: { icon: Loader2, tone: "text-brand", spin: true },
  IN_PROGRESS: { icon: CirclePlay, tone: "text-brand" },
  COMPLETED: { icon: CircleCheck, tone: "text-success" },
  FAILED: { icon: CircleAlert, tone: "text-destructive" },
};

export function InterviewStatusBadge({
  status,
  className,
}: {
  status: InterviewStatus;
  className?: string;
}) {
  const { icon: Icon, tone, spin } = ICONS[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <Icon className={cn("size-3", tone, spin && "animate-spin")} aria-hidden />
      {INTERVIEW_STATUS_LABELS[status]}
    </Badge>
  );
}
