"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FileText, Loader2, Sparkles } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { createJobMatchAction } from "@/app/dashboard/job-match/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import {
  JOB_DESCRIPTION_MAX,
  JOB_DESCRIPTION_MIN,
  jobMatchInputSchema,
} from "@/lib/job-match/validation";
import { cn } from "@/lib/utils";

export type CvOption = {
  id: string;
  fileName: string;
  uploadedAt: Date;
  lastAnalyzedAt: Date | null;
  score: number | null;
};

export function JobMatchForm({ cvs }: { cvs: CvOption[] }) {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(jobMatchInputSchema),
    defaultValues: {
      cvId: cvs.length === 1 ? cvs[0]!.id : "",
      jobTitle: "",
      company: "",
      location: "",
      jobUrl: "",
      jobDescription: "",
    },
  });
  const { pending, formError, run } = useActionForm(form);
  const { errors } = form.formState;
  const [selectedCv, description] = useWatch({
    control: form.control,
    name: ["cvId", "jobDescription"],
  });

  // Client validation first; the server re-validates the raw values.
  const onSubmit = form.handleSubmit(() =>
    run(
      () => createJobMatchAction(form.getValues()),
      (result) => router.push(`/dashboard/job-match/${result.jobId}?analysis=${result.analysisId}`),
    ),
  );

  return (
    <form noValidate onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            New job match
          </CardTitle>
          <CardDescription>
            Pick a CV, paste the job description, and compare them requirement by requirement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {formError && <FormAlert>{formError}</FormAlert>}

          <fieldset
            className="grid gap-3"
            aria-describedby={errors.cvId ? "cvId-error" : undefined}
          >
            <legend className="mb-1 text-sm font-medium">1. Select a CV</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {cvs.map((cv) => {
                const checked = selectedCv === cv.id;
                return (
                  <label
                    key={cv.id}
                    className={cn(
                      "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
                      checked ? "border-brand bg-brand/5" : "hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      value={cv.id}
                      className="sr-only"
                      {...form.register("cvId")}
                    />
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/40">
                      <FileText className="size-4 text-brand" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" title={cv.fileName}>
                        {cv.fileName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Uploaded {formatDate(cv.uploadedAt)}
                        {cv.lastAnalyzedAt && ` · Analyzed ${formatDate(cv.lastAnalyzedAt)}`}
                      </span>
                      {cv.score !== null && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          CV score <span className="font-medium text-foreground">{cv.score}</span>
                          /100
                        </span>
                      )}
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
              })}
            </div>
            {errors.cvId && (
              <p id="cvId-error" role="alert" className="text-xs text-destructive">
                {errors.cvId.message}
              </p>
            )}
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="mb-1 text-sm font-medium">2. Job details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="jobTitle"
                label="Job title (optional)"
                error={errors.jobTitle?.message}
              >
                <Input
                  id="jobTitle"
                  className={controlClassName}
                  placeholder="e.g. Machine Learning Engineer"
                  aria-invalid={Boolean(errors.jobTitle)}
                  aria-describedby={fieldDescribedBy("jobTitle", errors.jobTitle?.message)}
                  {...form.register("jobTitle")}
                />
              </FormField>
              <FormField id="company" label="Company (optional)" error={errors.company?.message}>
                <Input
                  id="company"
                  className={controlClassName}
                  aria-invalid={Boolean(errors.company)}
                  aria-describedby={fieldDescribedBy("company", errors.company?.message)}
                  {...form.register("company")}
                />
              </FormField>
              <FormField id="location" label="Location (optional)" error={errors.location?.message}>
                <Input
                  id="location"
                  className={controlClassName}
                  placeholder="e.g. Remote, Berlin"
                  aria-invalid={Boolean(errors.location)}
                  aria-describedby={fieldDescribedBy("location", errors.location?.message)}
                  {...form.register("location")}
                />
              </FormField>
              <FormField id="jobUrl" label="Job URL (optional)" error={errors.jobUrl?.message}>
                <Input
                  id="jobUrl"
                  type="url"
                  inputMode="url"
                  className={controlClassName}
                  placeholder="https://…"
                  aria-invalid={Boolean(errors.jobUrl)}
                  aria-describedby={fieldDescribedBy("jobUrl", errors.jobUrl?.message)}
                  {...form.register("jobUrl")}
                />
              </FormField>
            </div>
            <FormField
              id="jobDescription"
              label="Job description"
              error={errors.jobDescription?.message}
              hint={`${description.length.toLocaleString("en")} / ${JOB_DESCRIPTION_MAX.toLocaleString("en")} characters · at least ${JOB_DESCRIPTION_MIN}`}
              persistentHint
            >
              <Textarea
                id="jobDescription"
                rows={12}
                className="max-h-[60vh] min-h-56"
                placeholder="Paste the full job description, including requirements and responsibilities."
                aria-invalid={Boolean(errors.jobDescription)}
                aria-describedby={fieldDescribedBy(
                  "jobDescription",
                  errors.jobDescription?.message,
                  true,
                  true,
                )}
                {...form.register("jobDescription")}
              />
            </FormField>
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Your CV and this job description stay private to your account.
            </p>
            <Button type="submit" className="h-10 md:h-9" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Analyze match
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
