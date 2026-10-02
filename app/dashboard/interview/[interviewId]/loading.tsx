import { Skeleton } from "@/components/ui/skeleton";

export default function InterviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading interview">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64 max-w-[60vw]" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="hidden h-72 w-full rounded-xl lg:block" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
