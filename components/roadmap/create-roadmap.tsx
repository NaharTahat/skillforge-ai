"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Check, FileText, Loader2, Map, Target } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { createRoadmapAction } from "@/app/dashboard/roadmap/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoadmapSources } from "@/lib/data/roadmap";
import { formatDate } from "@/lib/format";
import { TIMEFRAMES } from "@/lib/roadmap/constants";
import type { CreateRoadmapInput } from "@/lib/roadmap/validation";
import { cn } from "@/lib/utils";

function useCreateRoadmap() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(input: CreateRoadmapInput) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createRoadmapAction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/dashboard/roadmap/${result.roadmapId}`);
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return { pending, error, setError, submit };
}

function OptionCard({
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  meta,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: ReactNode;
  title: string;
  meta: ReactNode;
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
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={title}>
          {title}
        </span>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </span>
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

export function JobMatchRoadmapForm({ jobMatches }: { jobMatches: RoadmapSources["jobMatches"] }) {
  const [jobId, setJobId] = useState(jobMatches.length === 1 ? jobMatches[0]!.id : "");
  const { pending, error, setError, submit } = useCreateRoadmap();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!jobId) {
          setError("Select a job match to build the roadmap from.");
          return;
        }
        submit({ source: "JOB_MATCH", jobId });
      }}
    >
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle role="heading" aria-level={2}>
              Create from Job Match
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              Recommended
            </Badge>
          </div>
          <CardDescription>
            Built from a specific job&apos;s requirements and your Job Match result, so every gap
            traces back to the job description.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          {jobMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm">
              <p className="font-medium">Create a Job Match first.</p>
              <p className="mt-1 text-muted-foreground">
                A job roadmap needs a completed Job Match whose CV still exists.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 h-9 sm:h-8">
                <Link href="/dashboard/job-match">Go to Job Match</Link>
              </Button>
            </div>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Select a job match</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {jobMatches.map((job) => (
                  <OptionCard
                    key={job.id}
                    name="jobId"
                    value={job.id}
                    checked={jobId === job.id}
                    onChange={setJobId}
                    icon={<Briefcase className="size-4 text-brand" />}
                    title={[job.title ?? "Untitled job", job.company].filter(Boolean).join(" · ")}
                    meta={
                      <>
                        {job.matchScore !== null && <>Match {job.matchScore}/100 · </>}
                        CV: {job.cvFileName ?? "—"}
                        {job.matchedAt && <> · {formatDate(job.matchedAt)}</>}
                      </>
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}
          {jobMatches.length > 0 && (
            <div className="flex justify-end">
              <Button type="submit" className="h-10 md:h-9" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Map />}
                Generate job roadmap
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

export function CareerGoalRoadmapForm({
  analyzedCvs,
  careerGoal,
  experienceLevel,
}: Pick<RoadmapSources, "analyzedCvs" | "careerGoal" | "experienceLevel">) {
  const [cvId, setCvId] = useState(analyzedCvs[0]?.id ?? "");
  const [timeframe, setTimeframe] = useState("");
  const { pending, error, setError, submit } = useCreateRoadmap();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!cvId) {
          setError("Select an analyzed CV.");
          return;
        }
        submit({ source: "CAREER_GOAL", cvId, timeframeWeeks: timeframe });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Create from Career Goal
          </CardTitle>
          <CardDescription>
            A general career-goal roadmap based on your profile goal and CV. It isn&apos;t tied to a
            specific job description.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          {!careerGoal ? (
            <div className="rounded-xl border border-dashed p-4 text-sm">
              <p className="font-medium">Set a career goal in your Profile first.</p>
              <p className="mt-1 text-muted-foreground">
                The career goal is the target this roadmap is built toward.
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
                    <span className="truncate">{careerGoal}</span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Experience level</dt>
                  <dd className="mt-0.5 font-medium">{experienceLevel ?? "Not specified"}</dd>
                </div>
              </dl>

              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Analyzed CV</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {analyzedCvs.map((cv) => (
                    <OptionCard
                      key={cv.id}
                      name="cvId"
                      value={cv.id}
                      checked={cvId === cv.id}
                      onChange={setCvId}
                      icon={<FileText className="size-4 text-brand" />}
                      title={cv.fileName}
                      meta={
                        <>
                          {cv.score !== null && <>CV score {cv.score}/100</>}
                          {cv.analyzedAt && <> · Analyzed {formatDate(cv.analyzedAt)}</>}
                        </>
                      }
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Target timeframe (optional)</legend>
                <div className="flex flex-wrap gap-2">
                  {["", ...TIMEFRAMES.map(String)].map((value) => {
                    const checked = timeframe === value;
                    return (
                      <label
                        key={value || "none"}
                        className={cn(
                          "cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
                          checked ? "border-brand bg-brand/5 font-medium" : "hover:bg-muted/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="timeframeWeeks"
                          value={value}
                          checked={checked}
                          onChange={() => setTimeframe(value)}
                          className="sr-only"
                        />
                        {value ? `${value} weeks` : "No target"}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Task estimates stay realistic; if the plan needs longer than your target, the
                  roadmap says so.
                </p>
              </fieldset>

              <div className="flex justify-end">
                <Button type="submit" className="h-10 md:h-9" disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <Target />}
                  Generate career-goal roadmap
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
