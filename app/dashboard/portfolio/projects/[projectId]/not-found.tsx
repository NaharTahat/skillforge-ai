import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      titleAs="h2"
      title="Project not found"
      description="This project doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/portfolio/projects">Back to projects</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
