"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { FormAlert } from "@/components/forms/form-alert";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/auth/actions";
import { resetPasswordSchema } from "@/lib/validations/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const form = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });
  const { pending, formError, run } = useActionForm(form);
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  return (
    <div className="grid gap-6">
      {(formError || errors.token) && (
        <FormAlert>{formError ?? "This reset link is invalid. Request a new one."}</FormAlert>
      )}
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(() => run(() => resetPasswordAction(form.getValues())))}
      >
        <input type="hidden" {...form.register("token")} />
        <FormField
          id="password"
          label="New password"
          error={errors.password?.message}
          hint={<PasswordRequirements value={password} />}
          persistentHint
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className={controlClassName}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={fieldDescribedBy("password", errors.password?.message, true, true)}
            {...form.register("password")}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            className={controlClassName}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={fieldDescribedBy("confirmPassword", errors.confirmPassword?.message)}
            {...form.register("confirmPassword")}
          />
        </FormField>
        <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </div>
  );
}
