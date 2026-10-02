"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Runs a server action with already client-validated values and maps the
 * server's field errors back into react-hook-form.
 */
export function useActionForm<T extends FieldValues, C, O>(form: UseFormReturn<T, C, O>) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  function run<R extends ActionResult>(
    action: () => Promise<R>,
    onSuccess?: (result: Extract<R, { ok: true }>) => void,
  ) {
    setFormError(null);
    setFormSuccess(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (result.message) setFormSuccess(result.message);
          onSuccess?.(result as Extract<R, { ok: true }>);
          return;
        }
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          form.setError(field as Path<T>, { type: "server", message });
        }
        const hasFieldErrors = Object.keys(result.fieldErrors ?? {}).length > 0;
        setFormError(hasFieldErrors && !result.error ? null : (result.error ?? null));
      } catch {
        // Server-action redirects are handled by the router and don't land here.
        setFormError("Something went wrong. Please try again.");
      }
    });
  }

  return { pending, formError, formSuccess, run };
}
