"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addSkillAction, updateSkillAction } from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SKILL_LEVEL_LABELS,
  SKILL_LEVELS,
  type SkillLevel,
  type Visibility,
} from "@/lib/portfolio/constants";
import { nativeSelectClassName, SelectField, TextField, VisibilityField } from "./fields";
import { DeleteItemButton, VisibilityBadge, VisibilityToggle } from "./item-actions";
import { StrengthBadge } from "./strength-badge";

export type SkillRow = {
  id: string;
  name: string;
  level: SkillLevel;
  visibility: Visibility;
  summary: string | null;
  strength: { score: number; label: string };
  evidenceCount: number;
};

export function AddSkillForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<SkillLevel>("BEGINNER");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await addSkillAction({ name, level, visibility });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(
            result.fieldErrors && Object.keys(result.fieldErrors).length
              ? null
              : (result.error ?? null),
          );
          return;
        }
        setName("");
        toast.success("Skill added");
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="add-skill-heading"
      className="rounded-xl border bg-card p-4 sm:p-6"
    >
      <h2 id="add-skill-heading" className="mb-1 font-medium">
        Add a skill
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        The level is your own assessment. Evidence strength is calculated separately from your
        projects, certifications, assessments and interviews.
      </p>
      {formError && (
        <div className="mb-4">
          <FormAlert>{formError}</FormAlert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-start">
        <TextField
          id="skill-name"
          label="Skill"
          required
          value={name}
          onChange={setName}
          maxLength={40}
          placeholder="e.g. Python"
          error={errors.name}
        />
        <SelectField
          id="skill-level"
          label="Self-assessed level"
          value={level}
          onChange={setLevel}
          options={SKILL_LEVELS.map((l) => ({ value: l, label: SKILL_LEVEL_LABELS[l] }))}
        />
        <VisibilityField
          id="skill-visibility"
          value={visibility}
          onChange={setVisibility}
          hint="Private skills stay off your public page."
        />
        <Button
          type="submit"
          className="h-10 sm:col-span-2 md:h-9 lg:col-span-1 lg:mt-[1.375rem]"
          disabled={pending || !name.trim()}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add skill
        </Button>
      </div>
    </form>
  );
}

function LevelSelect({ skill }: { skill: SkillRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = `level-${skill.id}`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Self-assessed level for {skill.name}
      </label>
      <select
        id={id}
        value={skill.level}
        disabled={pending}
        className={`${nativeSelectClassName} w-auto`}
        onChange={(e) => {
          const level = e.target.value as SkillLevel;
          startTransition(async () => {
            try {
              const result = await updateSkillAction({
                id: skill.id,
                level,
                visibility: skill.visibility,
                summary: skill.summary ?? "",
              });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("Level updated");
              router.refresh();
            } catch {
              toast.error("Something went wrong. Please try again.");
            }
          });
        }}
      >
        {SKILL_LEVELS.map((l) => (
          <option key={l} value={l}>
            {SKILL_LEVEL_LABELS[l]}
          </option>
        ))}
      </select>
      {pending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />
      )}
    </div>
  );
}

export function SkillsList({ skills }: { skills: SkillRow[] }) {
  return (
    <ul className="grid gap-3" aria-label="Your skills">
      {skills.map((s) => (
        <li
          key={s.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
          data-testid="skill-row"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium break-words">{s.name}</h3>
              <VisibilityBadge visibility={s.visibility} />
              <StrengthBadge label={s.strength.label} score={s.strength.score} />
            </div>
            <p className="text-xs text-muted-foreground">
              {s.evidenceCount === 0
                ? "Self-reported — no evidence linked yet"
                : `${s.evidenceCount} piece${s.evidenceCount === 1 ? "" : "s"} of evidence`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LevelSelect skill={s} />
            <Button asChild variant="outline" size="sm" className="h-9 sm:h-8">
              <Link
                href={`/dashboard/skill-passport/${s.id}`}
                aria-label={`View evidence for ${s.name}`}
              >
                Evidence
                <ArrowRight />
              </Link>
            </Button>
            <VisibilityToggle kind="skill" id={s.id} visibility={s.visibility} label={s.name} />
            <DeleteItemButton kind="skill" id={s.id} label={s.name} what="skill" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LevelBadge({ level }: { level: SkillLevel }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {SKILL_LEVEL_LABELS[level]} <span className="sr-only">(self-assessed)</span>
    </Badge>
  );
}
