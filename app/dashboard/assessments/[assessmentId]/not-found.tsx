import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function AssessmentNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Assessment not found"
      description="This assessment doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/assessments">Back to Assessments</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
