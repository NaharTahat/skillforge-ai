import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function SkillNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      titleAs="h2"
      title="Skill not found"
      description="This skill doesn't exist or you don't have access to it."
      action={
        <Button asChild>
          <Link href="/dashboard/skill-passport">Back to Skill Passport</Link>
        </Button>
      }
      className="mt-8"
    />
  );
}
