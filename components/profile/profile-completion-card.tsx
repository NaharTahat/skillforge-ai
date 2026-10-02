import { CircleCheck, CircleDashed } from "lucide-react";
import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileCompletion } from "@/lib/profile/completion";

export function ProfileCompletionCard({ completion }: { completion: ProfileCompletion }) {
  const done = completion.missing.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile completion</CardTitle>
        <CardDescription>
          {completion.completed} of {completion.total} details added
        </CardDescription>
      </CardHeader>
      {/* Side-by-side and compact above the form on small screens; stacked in the sidebar. */}
      <CardContent className="flex items-center gap-5 lg:grid lg:gap-5">
        <div className="shrink-0 lg:hidden">
          <ReadinessRing value={completion.percent} size={80} label="Profile completion" />
        </div>
        <div className="hidden justify-center lg:flex">
          <ReadinessRing value={completion.percent} size={112} label="Profile completion" />
        </div>
        {done ? (
          <p className="flex items-center gap-2 text-sm text-success lg:justify-center">
            <CircleCheck className="size-4" /> Your profile is complete
          </p>
        ) : (
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Missing
            </p>
            <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {completion.missing.map((label) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
