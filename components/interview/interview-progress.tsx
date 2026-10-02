"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getInterviewStatusAction } from "@/app/dashboard/interview/actions";
import { StageList } from "@/components/shared/stage-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const POLL_MS = 1500;

/**
 * Each stage is a real checkpoint in lib/interview/service.ts: context is
 * loaded, ONE AI call writes the questions, code validates and grounds them,
 * then they are saved.
 */
const GENERATION_STAGES = [
  {
    key: "PREPARING",
    label: "Preparing interview context",
    detail: "Loading your CV, analysis and selected sources",
  },
  {
    key: "GENERATING",
    label: "Generating interview questions",
    detail: "One AI pass writes questions from your sources",
  },
  {
    key: "VALIDATING",
    label: "Validating questions",
    detail: "Checking every question traces back to your CV, job match, roadmap or career goal",
  },
  { key: "FINALIZING", label: "Finalizing interview", detail: "Saving your questions" },
] as const;

type Stage = (typeof GENERATION_STAGES)[number]["key"];

export function InterviewGenerationProgress({
  interviewId,
  initialStage,
  queued,
}: {
  interviewId: string;
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
        const result = await getInterviewStatusAction(interviewId);
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
  }, [interviewId, router]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Preparing your interview
        </CardTitle>
        <CardDescription>
          This usually takes under a minute. You can leave this page — preparation keeps running.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StageList
          stages={GENERATION_STAGES}
          current={stage}
          currentNote={isQueued ? "Queued" : undefined}
        />
      </CardContent>
    </Card>
  );
}
