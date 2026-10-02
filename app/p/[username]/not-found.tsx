import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Same message whether the portfolio is private, the item is private, or nothing exists. */
export default function PublicNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="font-mono text-sm text-brand">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Portfolio not available</h1>
      <p className="mt-3 text-muted-foreground">
        This page doesn&apos;t exist or isn&apos;t public.
      </p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/">Go to SkillForge AI</Link>
      </Button>
    </div>
  );
}
