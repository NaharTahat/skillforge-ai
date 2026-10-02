"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { FormAlert } from "@/components/forms/form-alert";
import { controlClassName, fieldDescribedBy, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/validations/auth";

type LoginFormProps = {
  callbackUrl?: string;
  googleEnabled: boolean;
  notice?: { variant: "error" | "success"; message: string } | null;
};

export function LoginForm({ callbackUrl, googleEnabled, notice }: LoginFormProps) {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { pending, formError, run } = useActionForm(form);
  const { errors } = form.formState;

  return (
    <div className="grid gap-6">
      {formError ? (
        <FormAlert>{formError}</FormAlert>
      ) : (
        notice && <FormAlert variant={notice.variant}>{notice.message}</FormAlert>
      )}

      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(() => run(() => loginAction(form.getValues(), callbackUrl)))}
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

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAction={
            <Link
              href="/forgot-password"
              className="rounded-sm text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className={controlClassName}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={fieldDescribedBy("password", errors.password?.message)}
            {...form.register("password")}
          />
        </FormField>

        <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      <AuthDivider />
      <GoogleButton enabled={googleEnabled} callbackUrl={callbackUrl} />

      <p className="text-center text-sm text-muted-foreground">
        New to SkillForge AI?{" "}
        <Link href="/register" className="rounded-sm font-medium text-foreground hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
