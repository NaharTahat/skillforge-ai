import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth/auth-header";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { isGoogleAuthEnabled } from "@/lib/auth/providers";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = first(params.error);

  let notice: { variant: "error" | "success"; message: string } | null = null;
  if (first(params.reset) === "success") {
    notice = { variant: "success", message: "Password updated. Sign in with your new password." };
  } else if (first(params.registered)) {
    notice = { variant: "success", message: "Account created. Please sign in." };
  } else if (error) {
    const { title, description } = getAuthErrorMessage(error);
    notice = { variant: "error", message: `${title}. ${description}` };
  }

  return (
    <>
      <AuthHeader title="Welcome back" description="Sign in to continue to your dashboard." />
      <LoginForm
        callbackUrl={safeRedirectPath(first(params.callbackUrl))}
        googleEnabled={isGoogleAuthEnabled()}
        notice={notice}
      />
    </>
  );
}
