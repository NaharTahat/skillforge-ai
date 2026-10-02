"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAssessmentStatusAction } from "@/app/dashboard/assessments/actions";
import { StageList } from "@/components/shared/stage-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_MS = 1500;

/**
 * Each stage is a real checkpoint in lib/assessment/service.ts: skills and the
 * question plan are prepared in code, ONE AI pass writes the questions, code
 * validates every question against its planned slot, then they are saved.
 */
const STAGES = [
  {
    key: "PREPARING",
    label: "Preparing skills and question plan",
    detail: "Choosing skills from your sources and planning each question",
  },
  {
    key: "GENERATING",
    label: "Generating questions",
    detail: "One AI pass writes a question for each planned slot",
  },
  {
    key: "VALIDATING",
    label: "Validating questions",
    detail: "Checking skills, difficulty, answer data and duplicates for every question",
  },
  { key: "FINALIZING", label: "Finalizing assessment", detail: "Saving your questions" },
] as const;

type Stage = (typeof STAGES)[number]["key"];

export function AssessmentGenerationProgress({
  assessmentId,
  initialStage,
  queued,
}: {
  assessmentId: string;
  initialStage: Stage;
  queued: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [isQueued, setQueued] = useState(queued);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await getAssessmentStatusAction(assessmentId);
        if (cancelled) return;
        if (!result.ok || (result.status !== "DRAFT" && result.status !== "GENERATING")) {
          router.refresh();
          return;
        }
        setStage(result.stage);
        setQueued(result.status === "DRAFT");
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
  }, [assessmentId, router]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Preparing your assessment
        </CardTitle>
        <CardDescription>
          This usually takes under a minute. You can leave this page — preparation keeps running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StageList stages={STAGES} current={stage} currentNote={isQueued ? "Queued" : undefined} />
      </CardContent>
    </Card>
  );
}
