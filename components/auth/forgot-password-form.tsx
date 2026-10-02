"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/forms/form-alert";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { pending, formError, formSuccess, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <div className="grid gap-6">
      {formError && <FormAlert>{formError}</FormAlert>}
      {formSuccess && <FormAlert variant="success">{formSuccess}</FormAlert>}

      {!formSuccess && (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit(() =>
            run(() => requestPasswordResetAction(form.getValues())),
          )}
        >
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className={controlClassName}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={fieldDescribedBy("email", errors.email?.message)}
              {...form.register("email")}
            />
          </FormField>
          <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}

      <Button asChild variant="ghost" className="h-10">
        <Link href="/login">
          <ArrowLeft /> Back to sign in
        </Link>
      </Button>
    </div>
  );
}
