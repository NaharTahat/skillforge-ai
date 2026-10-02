import Link from "next/link";
import { FileX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function CvNotFound() {
  return (
    <EmptyState
      icon={FileX}
      title="CV not found"
      description="This CV doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/cv">Back to CV Analyzer</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
