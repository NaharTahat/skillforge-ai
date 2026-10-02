import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes, siteConfig } from "@/lib/config/site";

export function Cta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 bg-grid mask-[radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-brand/20 blur-[100px]"
        />
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Ready to see where you stand?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{siteConfig.tagline}</p>
          <Button asChild size="lg" className="mt-8 h-11 px-5 text-[15px]">
            <Link href={routes.getStarted}>
              Analyze My Career <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
