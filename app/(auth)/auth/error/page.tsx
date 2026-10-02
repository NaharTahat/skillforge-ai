import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { getAuthErrorMessage } from "@/lib/auth/errors";

export const metadata: Metadata = { title: "Sign-in error" };

export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const { error } = await searchParams;
  const { title, description } = getAuthErrorMessage(typeof error === "string" ? error : null);

  return (
    <>
      <div className="mb-6 grid size-12 place-items-center rounded-xl bg-destructive/10">
        <CircleAlert className="size-5 text-destructive" />
      </div>
      <AuthHeader title={title} description={description} />
      <div className="grid gap-3">
        <Button asChild className="h-10">
          <Link href="/login">Back to sign in</Link>
        </Button>
        <Button asChild variant="ghost" className="h-10">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </>
  );
}
