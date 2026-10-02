import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ReadinessRing } from "@/components/shared/readiness-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes, siteConfig } from "@/lib/config/site";

const previewSkills = [
  { name: "Python", value: 90 },
  { name: "Machine Learning", value: 72 },
  { name: "SQL", value: 55 },
  { name: "Cloud", value: 31 },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Backdrop: faint grid + a single soft brand glow. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-grid mask-[radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute top-[-20%] left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full glass px-3 py-1 text-xs font-normal"
          >
            <Sparkles className="size-3.5 text-brand" />
            Career intelligence, powered by AI
          </Badge>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-gradient">{siteConfig.name}</span>
          </h1>
          <p className="mt-5 text-xl text-balance text-foreground/90 sm:text-2xl">
            {siteConfig.tagline}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-muted-foreground">
            Understand where you stand, see exactly what the roles you want require, and follow a
            clear plan to close the gap.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 w-full px-5 text-[15px] sm:w-auto">
              <Link href={routes.getStarted}>
                Analyze My Career <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 w-full px-5 text-[15px] sm:w-auto"
            >
              <Link href="/#features">Explore Platform</Link>
            </Button>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** Static product illustration. Values are sample figures, labelled as such. */
function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl sm:mt-20">
      <div className="rounded-2xl border bg-card/60 p-1.5 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-2">
        <div className="rounded-xl border bg-card p-4 sm:p-7">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Career overview</p>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              Sample data
            </span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 p-6">
              <ReadinessRing value={74} label="Career readiness" />
              <p className="mt-3 text-xs text-muted-foreground">Career readiness</p>
            </div>

            <div className="space-y-4">
              {previewSkills.map((skill) => (
                <div key={skill.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{skill.name}</span>
                    <span className="text-muted-foreground tabular-nums">{skill.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-brand to-brand-2"
                      style={{ width: `${skill.value}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 pt-2 sm:gap-3">
                <PreviewStat label="Job matches" value="3" />
                <PreviewStat label="Roadmap" value="42%" />
                <PreviewStat label="Interview" value="81%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2.5 sm:px-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
