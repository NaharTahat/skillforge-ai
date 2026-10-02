"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Check,
  ClipboardCheck,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { createAssessmentAction } from "@/app/dashboard/assessments/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentSources } from "@/lib/data/assessment";
import {
  ASSESSMENT_TYPES,
  DEFAULT_QUESTION_COUNT,
  DEFAULT_TIME_LIMIT,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FOCUSES,
  FOCUS_LABELS,
  MAX_SKILLS,
  MIN_MIXED_SKILLS,
  QUESTION_COUNTS,
  TIME_LIMITS,
  TYPE_LABELS,
  type AssessmentSource,
  type AssessmentType,
  type Difficulty,
  type Focus,
} from "@/lib/assessment/constants";
import { cn } from "@/lib/utils";

const radioCard =
  "relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50";

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border",
        on && "border-brand bg-brand text-primary-foreground",
      )}
    >
      {on && <Check className="size-3" />}
    </span>
  );
}

function ChipGroup<T extends string | number | null>({
  legend,
  name,
  options,
  value,
  onChange,
  label,
  hint,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  hint?: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option === value;
          return (
            <label
              key={String(option)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
                checked ? "border-brand bg-brand/5 font-medium" : "hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(option)}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {label(option)}
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}

function SkillList({ skills }: { skills: string[] }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {skills.map((s) => (
        <Badge key={s} variant="secondary" className="font-normal">
          {s}
        </Badge>
      ))}
    </span>
  );
}

const SOURCE_META: Record<
  AssessmentSource,
  { title: string; description: string; icon: typeof Briefcase }
> = {
  JOB_MATCH: {
    title: "Job Match",
    description: "Test the skills a specific job asks for.",
    icon: Briefcase,
  },
  CAREER_GOAL: {
    title: "Career Goal",
    description: "Test the core skills of your career goal.",
    icon: Target,
  },
  SKILL: { title: "Skill", description: "Test one skill you choose.", icon: ClipboardCheck },
  MIXED: {
    title: "Mixed",
    description: `Test ${MIN_MIXED_SKILLS}–${MAX_SKILLS} skills you choose.`,
    icon: Layers,
  },
};

export function CreateAssessmentForm({ sources }: { sources: AssessmentSources }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<AssessmentSource>(
    sources.jobMatches.length > 0 ? "JOB_MATCH" : "SKILL",
  );
  const [jobId, setJobId] = useState(sources.jobMatches[0]?.id ?? "");
  const [cvId, setCvId] = useState(sources.analyzedCvs[0]?.id ?? "");
  const cv = sources.analyzedCvs.find((c) => c.id === cvId);
  const [skill, setSkill] = useState(cv?.verifiedSkills[0] ?? "Python");
  const [mixed, setMixed] = useState<string[]>(cv?.verifiedSkills.slice(0, 3) ?? []);
  const [type, setType] = useState<AssessmentType>("MIXED");
  const [difficulty, setDifficulty] = useState<Difficulty>("ADAPTIVE");
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_QUESTION_COUNT);
  const [timeLimit, setTimeLimit] = useState<number | null>(DEFAULT_TIME_LIMIT);
  const [focus, setFocus] = useState<Focus>("MIXED");

  const job = sources.jobMatches.find((j) => j.id === jobId);
  const groups = [...new Set(sources.supportedSkills.map((s) => s.group))];

  const blocker =
    source === "JOB_MATCH"
      ? sources.jobMatches.length === 0
        ? "job"
        : job && job.skills.length === 0
          ? "job-skills"
          : null
      : source === "CAREER_GOAL" && !sources.careerGoal
        ? "goal"
        : source === "MIXED" && mixed.length < MIN_MIXED_SKILLS
          ? "mixed"
          : null;

  function submit() {
    setError(null);
    const config = { type, difficulty, questionCount, timeLimitMinutes: timeLimit, focus };
    const input =
      source === "JOB_MATCH"
        ? { source, jobId, ...config }
        : source === "CAREER_GOAL"
          ? { source, cvId, ...config }
          : { source, cvId, skills: source === "SKILL" ? [skill] : mixed, ...config };
    startTransition(async () => {
      try {
        const result = await createAssessmentAction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/dashboard/assessments/${result.assessmentId}`);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const cvPicker = sources.analyzedCvs.length > 1 && (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Analyzed CV</legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {sources.analyzedCvs.map((c) => (
          <label
            key={c.id}
            className={cn(
              radioCard,
              cvId === c.id ? "border-brand bg-brand/5" : "hover:bg-muted/40",
            )}
          >
            <input
              type="radio"
              name="cvId"
              value={c.id}
              checked={cvId === c.id}
              onChange={() => setCvId(c.id)}
              className="sr-only"
            />
            <FileText className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm" title={c.fileName}>
              {c.fileName}
            </span>
            <Tick on={cvId === c.id} />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            New assessment
          </CardTitle>
          <CardDescription>
            Questions are planned from your own sources and scored by SkillForge — the AI never sets
            your score.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {error && <FormAlert>{error}</FormAlert>}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">1. Source</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(SOURCE_META) as AssessmentSource[]).map((key) => {
                const meta = SOURCE_META[key];
                const checked = source === key;
                return (
                  <label
                    key={key}
                    className={cn(
                      radioCard,
                      checked ? "border-brand bg-brand/5" : "hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={key}
                      checked={checked}
                      onChange={() => {
                        setSource(key);
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    <meta.icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {meta.title}
                        {key === "JOB_MATCH" && sources.jobMatches.length > 0 && (
                          <Badge variant="secondary" className="font-normal">
                            Recommended
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                    <Tick on={checked} />
                  </label>
                );
              })}
            </div>
          </fieldset>

          {source === "JOB_MATCH" &&
            (sources.jobMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">Create a Job Match first.</p>
                <p className="mt-1 text-muted-foreground">
                  A Job Match assessment tests the skills a specific job asks for.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 h-9 sm:h-8">
                  <Link href="/dashboard/job-match">Go to Job Match</Link>
                </Button>
              </div>
            ) : (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">2. Job match</legend>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sources.jobMatches.map((j) => (
                    <label
                      key={j.id}
                      className={cn(
                        radioCard,
                        jobId === j.id ? "border-brand bg-brand/5" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="jobId"
                        value={j.id}
                        checked={jobId === j.id}
                        onChange={() => setJobId(j.id)}
                        className="sr-only"
                      />
                      <Briefcase className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      <span className="min-w-0 flex-1 text-xs">
                        <span
                          className="block truncate text-sm font-medium"
                          title={j.title ?? "Untitled job"}
                        >
                          {j.title ?? "Untitled job"}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {j.company ?? "Company not specified"} · CV: {j.cvFileName}
                          {j.matchScore !== null && ` · Match ${j.matchScore}/100`}
                        </span>
                        {j.skills.length > 0 ? (
                          <>
                            <span className="mt-1 block text-muted-foreground">
                              Skills to test:
                            </span>
                            <SkillList skills={j.skills} />
                          </>
                        ) : (
                          <span className="mt-1 block text-muted-foreground">
                            No assessable skills found in this job.
                          </span>
                        )}
                      </span>
                      <Tick on={jobId === j.id} />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

          {source === "CAREER_GOAL" &&
            (!sources.careerGoal ? (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">Create a Career Goal first.</p>
                <p className="mt-1 text-muted-foreground">
                  Set the role you are working toward in your Profile.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 h-9 sm:h-8">
                  <Link href="/dashboard/profile">Go to Profile</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-muted/30 p-3.5 text-sm">
                  <p className="text-xs text-muted-foreground">Career goal (from Profile)</p>
                  <p className="mt-0.5 font-medium">{sources.careerGoal}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Core skills to test (your roadmap&apos;s skill gaps are added when available):
                  </p>
                  <SkillList skills={sources.careerGoalSkills} />
                </div>
                {cvPicker}
              </>
            ))}

          {source === "SKILL" && (
            <>
              <div className="grid gap-2">
                <label htmlFor="skill" className="text-sm font-medium">
                  2. Skill
                </label>
                <select
                  id="skill"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="h-10 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9 dark:bg-input/30"
                >
                  {groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {sources.supportedSkills
                        .filter((s) => s.group === g)
                        .map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                            {cv?.verifiedSkills.includes(s.name) ? " (in your CV)" : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {cvPicker}
            </>
          )}

          {source === "MIXED" && (
            <>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-sm font-medium">
                  2. Skills ({mixed.length} of {MAX_SKILLS} max)
                </legend>
                <div className="grid gap-3">
                  {groups.map((g) => (
                    <div key={g}>
                      <p className="mb-1.5 text-xs text-muted-foreground">{g}</p>
                      <div className="flex flex-wrap gap-2">
                        {sources.supportedSkills
                          .filter((s) => s.group === g)
                          .map((s) => {
                            const checked = mixed.includes(s.name);
                            const disabled = !checked && mixed.length >= MAX_SKILLS;
                            return (
                              <label
                                key={s.name}
                                className={cn(
                                  "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
                                  checked
                                    ? "border-brand bg-brand/5 font-medium"
                                    : "hover:bg-muted/40",
                                  disabled && "cursor-not-allowed opacity-50",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  name="skills"
                                  value={s.name}
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() =>
                                    setMixed(
                                      checked
                                        ? mixed.filter((m) => m !== s.name)
                                        : [...mixed, s.name],
                                    )
                                  }
                                  className="sr-only"
                                />
                                {checked && <Check className="size-3.5 text-brand" aria-hidden />}
                                {s.name}
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
                {mixed.length < MIN_MIXED_SKILLS && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Choose at least {MIN_MIXED_SKILLS} skills.
                  </p>
                )}
              </fieldset>
              {cvPicker}
            </>
          )}

          {blocker !== "job" && blocker !== "goal" && (
            <div className="grid gap-5 border-t pt-5">
              <p className="text-sm font-medium">3. Configuration</p>
              <ChipGroup
                legend="Assessment type"
                name="type"
                options={ASSESSMENT_TYPES}
                value={type}
                onChange={setType}
                label={(t) => TYPE_LABELS[t]}
              />
              <ChipGroup
                legend="Difficulty"
                name="difficulty"
                options={DIFFICULTIES}
                value={difficulty}
                onChange={setDifficulty}
                label={(d) => DIFFICULTY_LABELS[d]}
                hint={
                  difficulty === "ADAPTIVE"
                    ? "Adaptive sets each skill's level from your CV and Job Match evidence: Beginner when not shown, Intermediate when demonstrated — never Advanced from the CV alone."
                    : undefined
                }
              />
              <ChipGroup
                legend="Number of questions"
                name="questionCount"
                options={QUESTION_COUNTS}
                value={questionCount as (typeof QUESTION_COUNTS)[number]}
                onChange={setQuestionCount}
                label={(n) => `${n} questions`}
              />
              <ChipGroup
                legend="Time limit"
                name="timeLimit"
                options={TIME_LIMITS}
                value={timeLimit as (typeof TIME_LIMITS)[number]}
                onChange={setTimeLimit}
                label={(m) => (m === null ? "No limit" : `${m} minutes`)}
                hint="The timer starts when you press Start, not when the questions are generated."
              />
              <ChipGroup
                legend="Focus"
                name="focus"
                options={FOCUSES}
                value={focus}
                onChange={setFocus}
                label={(f) => FOCUS_LABELS[f]}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Your answers stay private to your account.
                </p>
                <Button
                  type="submit"
                  className="h-10 md:h-9"
                  disabled={pending || blocker !== null}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Generate assessment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
