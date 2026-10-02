"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  aiBioAction,
  aiHeadlineAction,
  updatePortfolioProfileAction,
} from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIMITS } from "@/lib/portfolio/constants";
import { TextAreaField, TextField } from "./fields";

type ProfileValues = {
  headline: string;
  bio: string;
  location: string;
  websiteUrl: string;
  githubUrl: string;
  linkedinUrl: string;
};

/** AI button for one field: generate → suggestion is placed in the field for review; nothing is saved until "Save". */
function AiButton({
  field,
  hasValue,
  pending,
  onClick,
}: {
  field: string;
  hasValue: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 sm:h-8"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? <Loader2 className="animate-spin" /> : hasValue ? <RotateCcw /> : <Sparkles />}
      {hasValue ? `Regenerate ${field}` : `Generate ${field} with AI`}
    </Button>
  );
}

export function ProfileEditor({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [aiField, setAiField] = useState<"headline" | "bio" | null>(null);
  const aiBusy = useRef(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  const set = (key: keyof ProfileValues) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function generate(field: "headline" | "bio") {
    // A ref, not state: a double-click fires before the disabled state renders.
    if (aiBusy.current) return;
    aiBusy.current = true;
    setAiField(field);
    setAiNote(null);
    try {
      const result = field === "headline" ? await aiHeadlineAction() : await aiBioAction();
      if (!result.ok) {
        toast.error(result.error);
        setAiNote(result.error);
        return;
      }
      setValues((v) => ({ ...v, [field]: result.text }));
      const count = "dropped" in result ? Number(result.dropped) : 0;
      const dropped = count > 0 ? ` ${count} unsupported sentence(s) were removed.` : "";
      setAiNote(
        `AI suggestion added to the ${field}, using only your portfolio details. Review and edit it, then save.${dropped}`,
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      aiBusy.current = false;
      setAiField(null);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startSave(async () => {
      try {
        const result = await updatePortfolioProfileAction(values);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error ?? null);
          return;
        }
        setSaved(values);
        setAiNote(null);
        toast.success("Profile saved");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={save} aria-labelledby="profile-editor-heading">
      <Card>
        <CardHeader>
          <CardTitle id="profile-editor-heading" role="heading" aria-level={2}>
            Profile
          </CardTitle>
          <CardDescription>
            Your headline and bio appear at the top of your public portfolio. AI suggestions only
            use details you&apos;ve added here — they never invent experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {formError && <FormAlert>{formError}</FormAlert>}
          {aiNote && (
            <p
              role="status"
              className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm"
            >
              {aiNote}
            </p>
          )}

          <div className="grid gap-2">
            <TextField
              id="headline"
              label="Headline"
              value={values.headline}
              onChange={set("headline")}
              maxLength={LIMITS.headline}
              placeholder="e.g. Junior Data Analyst | Python · SQL"
              error={errors.headline}
              hint={`${values.headline.length}/${LIMITS.headline} characters`}
            />
            <div>
              <AiButton
                field="headline"
                hasValue={Boolean(values.headline)}
                pending={aiField === "headline"}
                onClick={() => generate("headline")}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <TextAreaField
              id="bio"
              label="Bio"
              value={values.bio}
              onChange={set("bio")}
              maxLength={LIMITS.bio}
              rows={5}
              placeholder="A few sentences about what you do and what you're working toward."
              error={errors.bio}
            />
            <div>
              <AiButton
                field="bio"
                hasValue={Boolean(values.bio)}
                pending={aiField === "bio"}
                onClick={() => generate("bio")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="location"
              label="Location"
              value={values.location}
              onChange={set("location")}
              maxLength={100}
              placeholder="City, Country"
              error={errors.location}
            />
            <TextField
              id="websiteUrl"
              label="Website"
              type="url"
              value={values.websiteUrl}
              onChange={set("websiteUrl")}
              placeholder="https://…"
              error={errors.websiteUrl}
            />
            <TextField
              id="githubUrl"
              label="GitHub"
              type="url"
              value={values.githubUrl}
              onChange={set("githubUrl")}
              placeholder="https://github.com/…"
              error={errors.githubUrl}
            />
            <TextField
              id="linkedinUrl"
              label="LinkedIn"
              type="url"
              value={values.linkedinUrl}
              onChange={set("linkedinUrl")}
              placeholder="https://linkedin.com/in/…"
              error={errors.linkedinUrl}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-10 md:h-9"
              disabled={!dirty || saving}
              onClick={() => setValues(saved)}
            >
              Discard changes
            </Button>
            <Button type="submit" className="h-10 md:h-9" disabled={!dirty || saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
