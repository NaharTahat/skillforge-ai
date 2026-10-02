import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthHeader } from "@/components/auth/auth-header";
import { RegisterForm } from "@/components/auth/register-form";
import { isGoogleAuthEnabled } from "@/lib/auth/providers";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  // Provider availability is runtime configuration, not build-time.
  await connection();
  return (
    <>
      <AuthHeader
        title="Create your account"
        description="Start building a clear picture of your career readiness."
      />
      <RegisterForm googleEnabled={isGoogleAuthEnabled()} />
    </>
  );
}
