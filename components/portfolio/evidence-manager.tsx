"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addEvidenceAction } from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_KIND_LABELS,
  EVIDENCE_KINDS,
  LIMITS,
  type EvidenceKind,
} from "@/lib/portfolio/constants";
import { DeleteItemButton } from "./item-actions";
import { SelectField, TextField } from "./fields";

type Evidence = { id: string; kind: EvidenceKind; label: string | null; url: string };

/** Links the user provides as proof for a project. Shown as "user-provided", never as verified. */
export function EvidenceManager({
  projectId,
  evidence,
}: {
  projectId: string;
  evidence: Evidence[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<EvidenceKind>("REPOSITORY");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const full = evidence.length >= LIMITS.evidence;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await addEvidenceAction({ projectId, kind, label, url });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error ?? null);
          return;
        }
        setLabel("");
        setUrl("");
        toast.success("Evidence added");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby="evidence-heading" className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 id="evidence-heading" className="font-medium">
        Evidence links
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Repositories, demos, documentation or screenshots that back up this project. Shown as
        user-provided.
      </p>

      {evidence.length > 0 && (
        <ul className="mt-4 grid gap-2" aria-label="Evidence links">
          {evidence.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.label || EVIDENCE_KIND_LABELS[e.kind]}</p>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-xs break-all text-brand hover:underline"
                >
                  {e.url}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
                <p className="text-xs text-muted-foreground">
                  {EVIDENCE_KIND_LABELS[e.kind]} · user-provided
                </p>
              </div>
              <DeleteItemButton
                kind="evidence"
                id={e.id}
                label={e.label || e.url}
                what="evidence link"
              />
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;ve reached the limit of {LIMITS.evidence} links for this project.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={submit}
          className="mt-4 grid gap-3"
          aria-label="Add evidence link"
        >
          {formError && <FormAlert>{formError}</FormAlert>}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            <SelectField
              id="evidence-kind"
              label="Type"
              value={kind}
              onChange={setKind}
              options={EVIDENCE_KINDS.map((k) => ({ value: k, label: EVIDENCE_KIND_LABELS[k] }))}
            />
            <TextField
              id="evidence-label"
              label="Label (optional)"
              value={label}
              onChange={setLabel}
              maxLength={80}
              error={errors.label}
            />
          </div>
          <TextField
            id="evidence-url"
            label="URL"
            type="url"
            value={url}
            onChange={setUrl}
            placeholder="https://…"
            error={errors.url}
          />
          <div>
            <Button
              type="submit"
              variant="outline"
              className="h-10 md:h-9"
              disabled={pending || !url.trim()}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add evidence link
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
