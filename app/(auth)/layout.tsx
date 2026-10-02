import type { Metadata } from "next";
import { BadgeCheck, Crosshair, Route } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const highlights = [
  { icon: Crosshair, text: "See exactly how your CV compares to the roles you want" },
  { icon: Route, text: "Follow a personalized roadmap to close skill gaps" },
  { icon: BadgeCheck, text: "Prove your skills with assessments and a public passport" },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r bg-card p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-grid mask-[radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 size-[420px] rounded-full bg-brand/15 blur-[110px]"
        />
        <Logo className="relative" />
        <div className="relative max-w-md">
          <p className="text-3xl font-semibold tracking-tight text-balance">{siteConfig.tagline}</p>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background/60">
                  <Icon className="size-4 text-brand" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          AI insights are guidance, not guarantees of employment outcomes.
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Logo className="lg:hidden" />
          <span className="hidden lg:block" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:px-6 sm:py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
