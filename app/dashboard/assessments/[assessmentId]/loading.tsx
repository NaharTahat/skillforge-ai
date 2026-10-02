import { Skeleton } from "@/components/ui/skeleton";

export default function AssessmentLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading assessment">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64 max-w-[60vw]" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
