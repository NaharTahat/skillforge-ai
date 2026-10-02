import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth/auth-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || token.length < 20) {
    return (
      <>
        <AuthHeader title="Invalid reset link" />
        <div className="grid gap-6">
          <FormAlert>This password reset link is invalid or incomplete.</FormAlert>
          <Button asChild className="h-10">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        title="Choose a new password"
        description="You'll be signed out everywhere else."
      />
      <ResetPasswordForm token={token} />
    </>
  );
}
