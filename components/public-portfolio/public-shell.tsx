import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isSafeUrl } from "@/lib/portfolio/validation";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Content on this page is provided by its owner. Certifications and links are not verified
          by SkillForge AI.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-sm hover:text-foreground sm:min-h-0"
        >
          Built with SkillForge AI
        </Link>
      </div>
    </footer>
  );
}

/**
 * External link from user-provided data. Only absolute http(s) URLs render as
 * links (anything else is dropped); always opens without referrer or follow.
 */
export function SafeLink({
  href,
  children,
  className,
}: {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  if (!href || !isSafeUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      referrerPolicy="no-referrer"
      className={cn(
        "inline-flex min-h-10 items-center gap-1 rounded-sm text-sm text-brand hover:underline sm:min-h-0",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function PublicSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <h2 id={`${id}-heading`} className="mb-4 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
