import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { clearSessionAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Session expired" };

export default function SessionExpiredPage() {
  return (
    <>
      <div className="mb-6 grid size-12 place-items-center rounded-xl bg-muted">
        <Clock className="size-5 text-muted-foreground" />
      </div>
      <AuthHeader
        title="Your session has expired"
        description="For your security, please sign in again. This happens after signing out, a password change, or when an account is no longer available."
      />
      <form action={clearSessionAction}>
        <Button type="submit" className="h-10 w-full">
          Sign in again
        </Button>
      </form>
    </>
  );
}
