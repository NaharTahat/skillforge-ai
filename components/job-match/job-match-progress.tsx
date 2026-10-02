"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getJobAnalysisStatusAction } from "@/app/dashboard/job-match/actions";
import { StageList } from "@/components/shared/stage-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_MS = 2000;

/**
 * Stages map to real checkpoints. Extracting requirements, comparing skills and
 * evaluating experience happen in ONE AI pass, so they are shown as one stage.
 */
const JOB_MATCH_STAGES = [
  { key: "prepare", label: "Preparing CV and job description" },
  {
    key: "analyze",
    label: "Analyzing requirements and comparing with your CV",
    detail: "One AI pass identifies the job's requirements, then checks each one against your CV",
  },
  {
    key: "finalize",
    label: "Calculating match and finalizing report",
    detail: "Verifying evidence against both texts and computing the score",
  },
] as const;

type Stage = "QUEUED" | "ANALYZING" | "FINALIZING";

const STAGE_KEYS: Record<Stage, (typeof JOB_MATCH_STAGES)[number]["key"]> = {
  QUEUED: "prepare",
  ANALYZING: "analyze",
  FINALIZING: "finalize",
};

export function JobMatchProgress({
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
        const result = await getJobAnalysisStatusAction(analysisId);
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
          Analyzing this match
        </CardTitle>
        <CardDescription>
          This usually takes under a minute. You can leave this page — the analysis keeps running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StageList
          stages={JOB_MATCH_STAGES}
          current={STAGE_KEYS[stage]}
          currentNote={stage === "QUEUED" ? "Queued" : undefined}
        />
      </CardContent>
    </Card>
  );
}
