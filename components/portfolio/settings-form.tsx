"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/dashboard/portfolio/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTIONS, type SectionKey } from "@/lib/portfolio/constants";
import { CheckboxField, TextField } from "./fields";

export type SettingsValues = { username: string; isPublic: boolean } & Record<SectionKey, boolean>;

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await updateSettingsAction({
          ...values,
          username: values.username.trim().toLowerCase(),
        });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(
            result.fieldErrors && Object.keys(result.fieldErrors).length
              ? null
              : (result.error ?? null),
          );
          return;
        }
        const next = { ...values, username: values.username.trim().toLowerCase() };
        setValues(next);
        setSaved(next);
        toast.success(
          next.isPublic ? "Saved. Your portfolio is public." : "Saved. Your portfolio is private.",
        );
        router.refresh();
      } catch {
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form noValidate onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Public portfolio
          </CardTitle>
          <CardDescription>
            Your public page shows only items you marked public, inside the sections you switch on.
            Your email, phone, CV, answers, job matches and roadmap are never shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {formError && <FormAlert>{formError}</FormAlert>}
          <TextField
            id="username"
            label="Username"
            value={values.username}
            onChange={(username) => setValues((v) => ({ ...v, username }))}
            maxLength={30}
            placeholder="e.g. alex-kim"
            error={errors.username}
            hint={
              values.username
                ? `Your public address: /p/${values.username.trim().toLowerCase()}`
                : "3–30 lowercase letters, numbers or hyphens."
            }
          />
          <CheckboxField
            id="isPublic"
            label="Make my portfolio public"
            description="Anyone with the link can view your public page. Turn this off at any time to hide it immediately."
            checked={values.isPublic}
            onChange={(isPublic) => setValues((v) => ({ ...v, isPublic }))}
          />
          {errors.isPublic && (
            <p className="text-xs text-destructive" role="alert">
              {errors.isPublic}
            </p>
          )}

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Sections to show</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SECTIONS.map((s) => (
                <CheckboxField
                  key={s.key}
                  id={s.key}
                  label={s.label}
                  checked={values[s.key]}
                  onChange={(on) => setValues((v) => ({ ...v, [s.key]: on }))}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="h-10 md:h-9"
              disabled={!dirty || pending}
              onClick={() => setValues(saved)}
            >
              Discard changes
            </Button>
            <Button type="submit" className="h-10 md:h-9" disabled={!dirty || pending}>
              {pending && <Loader2 className="animate-spin" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
