import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function InterviewNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Interview not found"
      description="This interview doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/interview">Back to AI Interview</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
