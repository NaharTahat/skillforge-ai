import { CircleDashed } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { dashboardNav, secondaryNav } from "@/lib/config/navigation";

type FeaturePlaceholderProps = {
  href: string;
  /** Development phase in which the feature ships. */
  phase: number;
  capabilities: string[];
};

/** Honest "not built yet" screen for dashboard sections scheduled in later phases. */
export function FeaturePlaceholder({ href, phase, capabilities }: FeaturePlaceholderProps) {
  const item = [...dashboardNav, ...secondaryNav].find((nav) => nav.href === href);
  if (!item) throw new Error(`No navigation entry for ${href}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.description}
        actions={<Badge variant="outline">Coming in phase {phase}</Badge>}
      />
      <EmptyState
        icon={item.icon}
        title={`${item.title} is on the way`}
        description="This area isn't available yet. Here's what it will include:"
        action={
          <ul className="grid gap-2 text-left text-sm text-muted-foreground sm:grid-cols-2">
            {capabilities.map((capability) => (
              <li
                key={capability}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
              >
                <CircleDashed className="size-3.5 shrink-0 text-brand" aria-hidden />
                {capability}
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
