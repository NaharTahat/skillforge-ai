"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAnalysisStatusAction } from "@/app/dashboard/cv/actions";
import { AnalysisStages, type StageKey } from "@/components/cv/analysis-stages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_MS = 2000;

type Stage = "QUEUED" | "ANALYZING" | "FINALIZING";

function toStageKey(stage: Stage): StageKey {
  return stage === "FINALIZING" ? "finalize" : "analyze";
}

/** Polls the real analysis state and refreshes the page when it finishes. */
export function AnalysisProgress({
  analysisId,
  initialStage,
}: {
  analysisId: string;
  initialStage: Stage;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const result = await getAnalysisStatusAction(analysisId);
        if (cancelled) return;
        if (!result.ok || result.status === "COMPLETED" || result.status === "FAILED") {
          router.refresh();
          return;
        }
        setStage(result.stage);
      } catch {
        // Transient network error: keep polling.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [analysisId, router]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Analyzing your CV
        </CardTitle>
        <CardDescription>
          This usually takes under a minute. You can leave this page — the analysis keeps running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AnalysisStages
          current={toStageKey(stage)}
          currentNote={stage === "QUEUED" ? "Queued" : undefined}
        />
      </CardContent>
    </Card>
  );
}
