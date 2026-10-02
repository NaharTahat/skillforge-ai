import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function JobMatchNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Job match not found"
      description="This job match doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/job-match">Back to Job Match</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
