import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Button } from "@/components/ui/button";
import type { ProfileCompletion } from "@/lib/profile/completion";

/** Compact dashboard nudge; values come from the user's stored profile. */
export function ProfileCompletionPrompt({ completion }: { completion: ProfileCompletion }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <ReadinessRing value={completion.percent} size={52} label="Profile completion" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Complete your profile</p>
          <p className="text-sm text-muted-foreground">
            {completion.missing.length} of {completion.total} details missing — a complete profile
            makes future recommendations more relevant.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-9 sm:ml-auto">
        <Link href="/dashboard/profile">
          Complete profile <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  );
}
