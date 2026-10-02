import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth/auth-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeader
        title="Forgot your password?"
        description="Enter your email and we'll send you a link to reset it."
      />
      <ForgotPasswordForm />
    </>
  );
}
