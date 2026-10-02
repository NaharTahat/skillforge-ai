"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { aiSkillSummaryAction, updateSkillAction } from "@/app/dashboard/portfolio/actions";
import { TextAreaField } from "@/components/portfolio/fields";
import { Button } from "@/components/ui/button";
import type { SkillLevel, Visibility } from "@/lib/portfolio/constants";

/** Short skill summary. The AI may only restate the evidence listed on this page. */
export function SkillSummaryEditor({
  skill,
  hasEvidence,
}: {
  skill: {
    id: string;
    name: string;
    level: SkillLevel;
    visibility: Visibility;
    summary: string | null;
  };
  hasEvidence: boolean;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(skill.summary ?? "");
  const [saved, setSaved] = useState(skill.summary ?? "");
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [saving, startSave] = useTransition();

  async function generate() {
    if (aiPending) return;
    setAiPending(true);
    setNote(null);
    try {
      const result = await aiSkillSummaryAction(skill.id);
      if (!result.ok) {
        toast.error(result.error);
        setNote(result.error);
        return;
      }
      setSummary(result.text.slice(0, 400));
      setNote(
        "AI suggestion based only on the evidence listed on this page. Review it, then save.",
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAiPending(false);
    }
  }

  function save() {
    setError(undefined);
    startSave(async () => {
      try {
        const result = await updateSkillAction({
          id: skill.id,
          level: skill.level,
          visibility: skill.visibility,
          summary,
        });
        if (!result.ok) {
          setError(result.fieldErrors?.summary ?? result.error);
          return;
        }
        setSaved(summary);
        setNote(null);
        toast.success("Summary saved");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby="summary-heading" className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="summary-heading" className="mb-3 font-medium">
        Skill summary
      </h2>
      <div className="grid gap-3">
        {note && (
          <p
            role="status"
            className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm"
          >
            {note}
          </p>
        )}
        <TextAreaField
          id="skill-summary"
          label={`Summary for ${skill.name}`}
          value={summary}
          onChange={setSummary}
          maxLength={400}
          rows={3}
          error={error}
          placeholder="One or two sentences on how you've used this skill."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="h-10 md:h-9"
            disabled={aiPending || !hasEvidence}
            onClick={generate}
          >
            {aiPending ? (
              <Loader2 className="animate-spin" />
            ) : summary ? (
              <RotateCcw />
            ) : (
              <Sparkles />
            )}
            {summary ? "Regenerate summary" : "Generate summary with AI"}
          </Button>
          <Button
            type="button"
            className="h-10 md:h-9"
            disabled={saving || summary === saved}
            onClick={save}
          >
            {saving && <Loader2 className="animate-spin" />}
            Save summary
          </Button>
        </div>
        {!hasEvidence && (
          <p className="text-xs text-muted-foreground">
            AI summaries need at least one piece of evidence to work from.
          </p>
        )}
      </div>
    </section>
  );
}
