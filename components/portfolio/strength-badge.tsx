import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  Strong: "border-success/40 bg-success/10 text-foreground",
  Moderate: "border-brand/40 bg-brand/10 text-foreground",
  Limited: "border-amber-500/40 bg-amber-500/10 text-foreground",
};

/** Evidence strength, computed from linked records (never AI-assigned). */
export function StrengthBadge({
  label,
  score,
  className,
}: {
  label: string;
  score: number;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal", TONE[label], className)}
      title={`Evidence strength score ${score}/100`}
    >
      Evidence: {label}
    </Badge>
  );
}
