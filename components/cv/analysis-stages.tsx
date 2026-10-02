import { StageList } from "@/components/shared/stage-list";

/**
 * CV analysis stages. Each maps to a real checkpoint in the pipeline (upload
 * bytes, server-side extraction, the AI call, persisting the report).
 */
export const ANALYSIS_STAGES = [
  { key: "upload", label: "Uploading CV" },
  { key: "extract", label: "Extracting text" },
  {
    key: "analyze",
    label: "Analyzing CV",
    detail: "Understanding your CV, assessing skills and generating recommendations",
  },
  { key: "finalize", label: "Finalizing report" },
] as const;

export type StageKey = (typeof ANALYSIS_STAGES)[number]["key"];

export function AnalysisStages({
  current,
  currentNote,
  className,
}: {
  current: StageKey;
  currentNote?: string;
  className?: string;
}) {
  return (
    <StageList
      stages={ANALYSIS_STAGES}
      current={current}
      currentNote={currentNote}
      className={className}
    />
  );
}
