"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Check, FileText, Loader2, MessagesSquare, Target } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { createInterviewAction } from "@/app/dashboard/interview/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InterviewSources } from "@/lib/data/interview";
import {
  DEFAULT_QUESTION_COUNT,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FOCUSES,
  FOCUS_LABELS,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  JOB_ONLY_FOCUSES,
  QUESTION_COUNTS,
  type Difficulty,
  type Focus,
  type InterviewType,
} from "@/lib/interview/constants";
import { cn } from "@/lib/utils";

type Source = "JOB_MATCH" | "CAREER_GOAL";
type DifficultyDefault = { difficulty: Difficulty; basis: "profile" | "cv" | "not_specified" };

const BASIS_TEXT: Record<DifficultyDefault["basis"], string> = {
  profile: "Default from the experience level in your profile.",
  cv: "Default from the experience level in your CV analysis.",
  not_specified: "Experience level not specified in your profile or CV — defaulting to Entry.",
};

function OptionCard({
  name,
  value,
  checked,
  onChange,
  icon,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
        checked ? "border-brand bg-brand/5" : "hover:bg-muted/40",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border",
          checked && "border-brand bg-brand text-primary-foreground",
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
    </label>
  );
}

function ChipGroup<T extends string | number>({
  legend,
  name,
  options,
  value,
  onChange,
  label,
  hint,
  badge,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  hint?: ReactNode;
  badge?: (value: T) => string | null;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option === value;
          const tag = badge?.(option);
          return (
            <label
              key={String(option)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
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
              {tag && (
                <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                  {tag}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </fieldset>
  );
}

export function CreateInterviewForm({ sources }: { sources: InterviewSources }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const firstJob = sources.jobMatches[0];
  const firstCv = sources.analyzedCvs[0];
  const [source, setSource] = useState<Source>(firstJob ? "JOB_MATCH" : "CAREER_GOAL");
  const [jobId, setJobId] = useState(firstJob?.id ?? "");
  const [cvId, setCvId] = useState(firstCv?.id ?? "");
  const [type, setType] = useState<InterviewType>("MIXED");
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_QUESTION_COUNT);

  const job = sources.jobMatches.find((j) => j.id === jobId);
  const cv = sources.analyzedCvs.find((c) => c.id === cvId);
  const difficultyDefault: DifficultyDefault | undefined =
    source === "JOB_MATCH" ? job?.defaultDifficulty : cv?.defaultDifficulty;
  const recommended: Focus | null = source === "JOB_MATCH" ? (job?.recommendedFocus ?? null) : null;

  const [difficulty, setDifficulty] = useState<Difficulty>(
    (firstJob ? firstJob.defaultDifficulty : firstCv?.defaultDifficulty)?.difficulty ?? "ENTRY",
  );
  const [focus, setFocus] = useState<Focus>(
    firstJob ? firstJob.recommendedFocus : "TECHNICAL_DEPTH",
  );

  // Choosing a source or a job resets the defaults that depend on it.
  function chooseSource(next: Source) {
    setSource(next);
    setError(null);
    if (next === "JOB_MATCH" && job) {
      setDifficulty(job.defaultDifficulty.difficulty);
      setFocus(job.recommendedFocus);
    } else if (next === "CAREER_GOAL") {
      setDifficulty(cv?.defaultDifficulty.difficulty ?? "ENTRY");
      if (JOB_ONLY_FOCUSES.includes(focus)) setFocus("TECHNICAL_DEPTH");
    }
  }
  function chooseJob(id: string) {
    setJobId(id);
    const next = sources.jobMatches.find((j) => j.id === id);
    if (next) {
      setDifficulty(next.defaultDifficulty.difficulty);
      setFocus(next.recommendedFocus);
    }
  }
  function chooseCv(id: string) {
    setCvId(id);
    const next = sources.analyzedCvs.find((c) => c.id === id);
    if (next) setDifficulty(next.defaultDifficulty.difficulty);
  }

  const sourceReady =
    source === "JOB_MATCH" ? sources.jobMatches.length > 0 : Boolean(sources.careerGoal);
  const focusOptions =
    source === "JOB_MATCH" ? FOCUSES : FOCUSES.filter((f) => !JOB_ONLY_FOCUSES.includes(f));

  function submit() {
    setError(null);
    const config = { type, difficulty, questionCount, focus };
    const input =
      source === "JOB_MATCH" ? { source, jobId, ...config } : { source, cvId, ...config };
    startTransition(async () => {
      try {
        const result = await createInterviewAction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/dashboard/interview/${result.interviewId}`);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

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
            New interview
          </CardTitle>
          <CardDescription>
            Questions are generated from your own CV, job match, roadmap and career goal — each one
            shows why it was chosen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {error && <FormAlert>{error}</FormAlert>}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">1. Interview source</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OptionCard
                name="source"
                value="JOB_MATCH"
                checked={source === "JOB_MATCH"}
                onChange={() => chooseSource("JOB_MATCH")}
                icon={<Briefcase className="size-4 text-brand" />}
              >
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  Job Match interview
                  <Badge variant="secondary" className="font-normal">
                    Recommended
                  </Badge>
                </span>
                <span className="block text-xs text-muted-foreground">
                  Built from a specific job description and your match result.
                </span>
              </OptionCard>
              <OptionCard
                name="source"
                value="CAREER_GOAL"
                checked={source === "CAREER_GOAL"}
                onChange={() => chooseSource("CAREER_GOAL")}
                icon={<Target className="size-4 text-brand" />}
              >
                <span className="block text-sm font-medium">Career Goal Interview</span>
                <span className="block text-xs text-muted-foreground">
                  Based on your career goal, CV and roadmap — not a specific job.
                </span>
              </OptionCard>
            </div>
          </fieldset>

          {source === "JOB_MATCH" &&
            (sources.jobMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">
                  Create a Job Match first to generate a job-specific interview.
                </p>
                <p className="mt-1 text-muted-foreground">
                  You can also start a Career Goal Interview without one.
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
                    <OptionCard
                      key={j.id}
                      name="jobId"
                      value={j.id}
                      checked={jobId === j.id}
                      onChange={chooseJob}
                      icon={<Briefcase className="size-4 text-brand" />}
                    >
                      <dl className="grid gap-0.5 text-xs">
                        <div className="flex min-w-0 gap-1">
                          <dt className="shrink-0 text-muted-foreground">Interview for:</dt>
                          <dd
                            className="truncate font-medium text-foreground"
                            title={j.title ?? "Untitled job"}
                          >
                            {j.title ?? "Untitled job"}
                          </dd>
                        </div>
                        <div className="flex min-w-0 gap-1">
                          <dt className="shrink-0 text-muted-foreground">Company:</dt>
                          <dd className="truncate">{j.company ?? "Not specified"}</dd>
                        </div>
                        <div className="flex min-w-0 gap-1">
                          <dt className="shrink-0 text-muted-foreground">CV:</dt>
                          <dd className="truncate">{j.cvFileName}</dd>
                        </div>
                        <div className="flex min-w-0 gap-1">
                          <dt className="shrink-0 text-muted-foreground">Match score:</dt>
                          <dd>{j.matchScore !== null ? `${j.matchScore}/100` : "Not available"}</dd>
                        </div>
                      </dl>
                    </OptionCard>
                  ))}
                </div>
              </fieldset>
            ))}

          {source === "CAREER_GOAL" &&
            (!sources.careerGoal ? (
              <div className="rounded-xl border border-dashed p-4 text-sm">
                <p className="font-medium">Set your career goal in Profile first.</p>
                <p className="mt-1 text-muted-foreground">
                  The career goal is the role a Career Goal Interview prepares you for.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3 h-9 sm:h-8">
                  <Link href="/dashboard/profile">Go to Profile</Link>
                </Button>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/30 p-3.5 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Career goal (from Profile)</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                      <Target className="size-3.5 shrink-0 text-brand" aria-hidden />
                      <span className="truncate">{sources.careerGoal}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Experience level</dt>
                    <dd className="mt-0.5 font-medium">
                      {sources.experienceLevel ?? "Not specified"}
                    </dd>
                  </div>
                </dl>
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium">2. Analyzed CV</legend>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {sources.analyzedCvs.map((c) => (
                      <OptionCard
                        key={c.id}
                        name="cvId"
                        value={c.id}
                        checked={cvId === c.id}
                        onChange={chooseCv}
                        icon={<FileText className="size-4 text-brand" />}
                      >
                        <span className="block truncate text-sm font-medium" title={c.fileName}>
                          {c.fileName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {c.score !== null ? `CV score ${c.score}/100` : "Analyzed"}
                        </span>
                      </OptionCard>
                    ))}
                  </div>
                </fieldset>
              </>
            ))}

          {sourceReady && (
            <div className="grid gap-5 border-t pt-5">
              <p className="text-sm font-medium">3. Configuration</p>
              <ChipGroup
                legend="Interview type"
                name="type"
                options={INTERVIEW_TYPES}
                value={type}
                onChange={setType}
                label={(t) => INTERVIEW_TYPE_LABELS[t]}
              />
              <ChipGroup
                legend="Difficulty"
                name="difficulty"
                options={DIFFICULTIES}
                value={difficulty}
                onChange={setDifficulty}
                label={(d) => DIFFICULTY_LABELS[d]}
                hint={difficultyDefault ? BASIS_TEXT[difficultyDefault.basis] : undefined}
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
                legend="Focus"
                name="focus"
                options={focusOptions}
                value={focus}
                onChange={setFocus}
                label={(f) => FOCUS_LABELS[f]}
                badge={(f) => (f === recommended ? "Recommended" : null)}
                hint={
                  recommended
                    ? recommended === "MISSING_SKILLS"
                      ? "Recommended because some required skills are missing or partial in your Job Match."
                      : "Recommended because your Job Match shows the required skills in your CV."
                    : undefined
                }
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Your answers stay private to your account.
                </p>
                <Button type="submit" className="h-10 md:h-9" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <MessagesSquare />}
                  Start interview
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
