"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Replace with an error-reporting service in production (Phase 10).
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page couldn't be loaded"
      description="An unexpected error occurred. Your data is safe — please try again."
      onRetry={retry}
      className="mt-8"
    />
  );
}
