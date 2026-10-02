"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRoadmapStatusAction } from "@/app/dashboard/roadmap/actions";
import { StageList } from "@/components/shared/stage-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_MS = 2000;

/**
 * Stages map to real checkpoints. Gap review and plan building happen in ONE
 * AI pass; grounding, prioritization and saving happen in code afterwards.
 */
const ROADMAP_STAGES = [
  { key: "prepare", label: "Preparing profile and sources" },
  {
    key: "analyze",
    label: "Reviewing skill gaps and building the roadmap",
    detail: "One AI pass compares your CV with the target and drafts phases and tasks",
  },
  {
    key: "finalize",
    label: "Ordering priorities and finalizing",
    detail: "Verifying evidence, ordering tasks by priority and saving your roadmap",
  },
] as const;

type Stage = "QUEUED" | "ANALYZING" | "FINALIZING";

const STAGE_KEYS: Record<Stage, (typeof ROADMAP_STAGES)[number]["key"]> = {
  QUEUED: "prepare",
  ANALYZING: "analyze",
  FINALIZING: "finalize",
};

export function RoadmapProgress({
  roadmapId,
  initialStage,
}: {
  roadmapId: string;
  initialStage: Stage;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const result = await getRoadmapStatusAction(roadmapId);
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
  }, [roadmapId, router]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Building your roadmap
        </CardTitle>
        <CardDescription>
          This usually takes under a minute. You can leave this page — generation keeps running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StageList
          stages={ROADMAP_STAGES}
          current={STAGE_KEYS[stage]}
          currentNote={stage === "QUEUED" ? "Queued" : undefined}
        />
      </CardContent>
    </Card>
  );
}
