import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  icon: LucideIcon;
  value: ReactNode;
  caption: ReactNode;
  href: string;
  footer?: ReactNode;
};

/** Headline number tile linking to its feature area. */
export function StatCard({ title, icon: Icon, value, caption, href, footer }: StatCardProps) {
  return (
    <Card className="group relative transition-colors hover:border-foreground/15">
      <CardContent className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="size-4" />
            {title}
          </div>
          <Link
            href={href}
            className="rounded-sm text-muted-foreground transition-colors after:absolute after:inset-0 hover:text-foreground"
          >
            <ArrowUpRight className="size-4" />
            <span className="sr-only">Open {title}</span>
          </Link>
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}
