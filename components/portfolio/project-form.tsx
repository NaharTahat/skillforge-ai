"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { aiProjectAction, saveProjectAction } from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LIMITS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatus,
  type Visibility,
} from "@/lib/portfolio/constants";
import { CheckboxField, SelectField, TextAreaField, TextField, VisibilityField } from "./fields";

export type ProjectFormValues = {
  title: string;
  shortDescription: string;
  description: string;
  role: string;
  technologies: string[];
  skillIds: string[];
  repositoryUrl: string;
  liveUrl: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  featured: boolean;
  visibility: Visibility;
};

export const EMPTY_PROJECT: ProjectFormValues = {
  title: "",
  shortDescription: "",
  description: "",
  role: "",
  technologies: [],
  skillIds: [],
  repositoryUrl: "",
  liveUrl: "",
  imageUrl: "",
  startDate: "",
  endDate: "",
  status: "COMPLETED",
  featured: false,
  visibility: "PRIVATE",
};

export function ProjectForm({
  projectId,
  initial,
  skills,
}: {
  projectId: string | null;
  initial: ProjectFormValues;
  /** The user's own skills (UserSkill id + name). */
  skills: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tech, setTech] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const aiBusy = useRef(false);
  const [saving, startSave] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  const set =
    <K extends keyof ProjectFormValues>(key: K) =>
    (value: ProjectFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  function addTech() {
    const parts = tech
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setValues((v) => {
      const next = [...v.technologies];
      for (const p of parts)
        if (
          !next.some((t) => t.toLowerCase() === p.toLowerCase()) &&
          next.length < LIMITS.technologies
        )
          next.push(p.slice(0, LIMITS.technology));
      return { ...v, technologies: next };
    });
    setTech("");
  }

  async function improve() {
    // A ref, not state: a double-click fires before the disabled state renders.
    if (aiBusy.current) return;
    aiBusy.current = true;
    setAiPending(true);
    setAiNote(null);
    try {
      const result = await aiProjectAction({
        title: values.title,
        shortDescription: values.shortDescription,
        description: values.description,
        role: values.role,
        technologies: values.technologies,
        skills: skills.filter((s) => values.skillIds.includes(s.id)).map((s) => s.name),
        status: values.status,
      });
      if (!result.ok) {
        toast.error(result.error);
        setAiNote(result.error);
        return;
      }
      setValues((v) => ({ ...v, description: result.text.slice(0, LIMITS.description) }));
      setAiNote(
        `AI suggestion added to the description, based only on what you entered above. Review it, then save.${result.dropped > 0 ? ` ${result.dropped} unsupported line(s) were removed.` : ""}`,
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      aiBusy.current = false;
      setAiPending(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startSave(async () => {
      try {
        const result = await saveProjectAction({ id: projectId, project: values });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error);
          return;
        }
        setSaved(values);
        toast.success(projectId ? "Project saved" : "Project created");
        if (!projectId) router.push(`/dashboard/portfolio/projects/${result.projectId}`);
        else router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit} aria-label={projectId ? "Edit project" : "New project"}>
      <Card>
        <CardContent className="grid gap-5 pt-6">
          {formError && <FormAlert>{formError}</FormAlert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="title"
              label="Project title"
              required
              value={values.title}
              onChange={set("title")}
              maxLength={LIMITS.title}
              error={errors.title}
              className="sm:col-span-2"
            />
            <TextAreaField
              id="shortDescription"
              label="Short description *"
              value={values.shortDescription}
              onChange={set("shortDescription")}
              maxLength={LIMITS.shortDescription}
              rows={2}
              placeholder="One or two sentences: what it is and what problem it solves."
              error={errors.shortDescription}
              className="sm:col-span-2"
            />
          </div>

          <div className="grid gap-2">
            <TextAreaField
              id="description"
              label="Detailed description"
              value={values.description}
              onChange={set("description")}
              maxLength={LIMITS.description}
              rows={8}
              placeholder="How you built it, your contributions, challenges and results."
              error={errors.description}
            />
            {aiNote && (
              <p
                role="status"
                className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm"
              >
                {aiNote}
              </p>
            )}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 sm:h-8"
                disabled={aiPending || !values.title.trim() || !values.shortDescription.trim()}
                onClick={improve}
              >
                {aiPending ? (
                  <Loader2 className="animate-spin" />
                ) : values.description ? (
                  <RotateCcw />
                ) : (
                  <Sparkles />
                )}
                Improve with AI
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Uses only the title, descriptions, role, technologies and skills on this form.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="role"
              label="Your role"
              value={values.role}
              onChange={set("role")}
              maxLength={LIMITS.role}
              placeholder="e.g. Solo developer"
              error={errors.role}
            />
            <SelectField
              id="status"
              label="Status"
              value={values.status}
              onChange={set("status")}
              options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))}
              error={errors.status}
            />
            <TextField
              id="startDate"
              label="Start date"
              type="date"
              value={values.startDate}
              onChange={set("startDate")}
              error={errors.startDate}
            />
            <TextField
              id="endDate"
              label="End date"
              type="date"
              value={values.endDate}
              onChange={set("endDate")}
              error={errors.endDate}
              hint="Leave empty if ongoing."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tech-input">Technologies</Label>
            <div className="flex gap-2">
              <Input
                id="tech-input"
                value={tech}
                maxLength={200}
                placeholder="e.g. Python, Pandas"
                className="h-10 md:h-9"
                aria-describedby="tech-hint"
                onChange={(e) => setTech(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTech();
                  }
                }}
              />
              <Button type="button" variant="outline" className="h-10 md:h-9" onClick={addTech}>
                Add
              </Button>
            </div>
            <p id="tech-hint" className="text-xs text-muted-foreground">
              Press Enter or Add. Separate several with commas. Up to {LIMITS.technologies}.
            </p>
            {errors.technologies && (
              <p className="text-xs text-destructive" role="alert">
                {errors.technologies}
              </p>
            )}
            {values.technologies.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Technologies">
                {values.technologies.map((t) => (
                  <li key={t}>
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {t}
                      <button
                        type="button"
                        className="grid size-6 place-items-center rounded-sm hover:bg-muted"
                        aria-label={`Remove ${t}`}
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            technologies: v.technologies.filter((x) => x !== t),
                          }))
                        }
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Skills demonstrated</legend>
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add skills on the Skills tab first, then link them here. Linked projects count as
                evidence for those skills.
              </p>
            ) : (
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((s) => (
                  <CheckboxField
                    key={s.id}
                    id={`skill-${s.id}`}
                    label={s.name}
                    checked={values.skillIds.includes(s.id)}
                    onChange={(on) =>
                      setValues((v) => ({
                        ...v,
                        skillIds: on ? [...v.skillIds, s.id] : v.skillIds.filter((x) => x !== s.id),
                      }))
                    }
                  />
                ))}
              </div>
            )}
            {errors.skillIds && (
              <p className="text-xs text-destructive" role="alert">
                {errors.skillIds}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="repositoryUrl"
              label="Repository URL"
              type="url"
              value={values.repositoryUrl}
              onChange={set("repositoryUrl")}
              placeholder="https://github.com/…"
              error={errors.repositoryUrl}
            />
            <TextField
              id="liveUrl"
              label="Live demo URL"
              type="url"
              value={values.liveUrl}
              onChange={set("liveUrl")}
              placeholder="https://…"
              error={errors.liveUrl}
            />
            <TextField
              id="imageUrl"
              label="Image URL"
              type="url"
              value={values.imageUrl}
              onChange={set("imageUrl")}
              placeholder="https://…"
              hint="An https:// link to a screenshot."
              error={errors.imageUrl}
              className="sm:col-span-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <VisibilityField
              id="visibility"
              value={values.visibility}
              onChange={set("visibility")}
              hint="Private projects never appear on your public portfolio."
            />
            <CheckboxField
              id="featured"
              label="Featured project"
              description="Featured projects are listed first."
              checked={values.featured}
              onChange={set("featured")}
              className="sm:pt-7"
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
            <Button
              type="submit"
              className="h-10 md:h-9"
              disabled={saving || (!dirty && projectId !== null)}
            >
              {saving && <Loader2 className="animate-spin" />}
              {projectId ? "Save project" : "Create project"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
