"use client";

import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setFeaturedAction } from "@/app/dashboard/portfolio/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FeaturedToggle({
  id,
  featured,
  label,
}: {
  id: string;
  featured: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 sm:h-8"
      disabled={pending}
      aria-pressed={featured}
      aria-label={`${featured ? "Unfeature" : "Feature"} ${label}`}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await setFeaturedAction({ id, featured: !featured });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.refresh();
          } catch {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Star className={cn(featured && "fill-current text-amber-500")} />
      )}
      {featured ? "Featured" : "Feature"}
    </Button>
  );
}
