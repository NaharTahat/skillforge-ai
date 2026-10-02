"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { FormAlert } from "@/components/forms/form-alert";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerAction } from "@/lib/auth/actions";
import { registerSchema } from "@/lib/validations/auth";

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });
  const { pending, formError, run } = useActionForm(form);
  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  return (
    <div className="grid gap-6">
      {formError && <FormAlert>{formError}</FormAlert>}

      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(() => run(() => registerAction(form.getValues())))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="firstName" label="First name" error={errors.firstName?.message}>
            <Input
              id="firstName"
              autoComplete="given-name"
              className={controlClassName}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={fieldDescribedBy("firstName", errors.firstName?.message)}
              {...form.register("firstName")}
            />
          </FormField>
          <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
            <Input
              id="lastName"
              autoComplete="family-name"
              className={controlClassName}
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={fieldDescribedBy("lastName", errors.lastName?.message)}
              {...form.register("lastName")}
            />
          </FormField>
        </div>

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

        <FormField
          id="password"
          label="Password"
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
          label="Confirm password"
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
          Create account
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton enabled={googleEnabled} />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="rounded-sm font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
