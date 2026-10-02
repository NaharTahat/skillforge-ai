import {
  Briefcase,
  ClipboardCheck,
  FileText,
  FolderKanban,
  History,
  MessagesSquare,
  Route,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityItem } from "@/types/dashboard";

const kindIcons: Record<ActivityItem["kind"], LucideIcon> = {
  cv: FileText,
  job: Briefcase,
  roadmap: Route,
  interview: MessagesSquare,
  assessment: ClipboardCheck,
  project: FolderKanban,
};

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Your latest progress</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Your CV analyses, job matches and interviews will appear here."
            className="py-8"
          />
        ) : (
          <ol className="space-y-4">
            {items.map((item) => {
              const Icon = kindIcons[item.kind];
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{item.title}</p>
                    <time
                      dateTime={item.occurredAt}
                      className="mt-0.5 block text-xs text-muted-foreground"
                    >
                      {formatRelativeTime(item.occurredAt)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
