import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function RoadmapNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Roadmap not found"
      description="This roadmap doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/roadmap">Back to Career Roadmap</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
