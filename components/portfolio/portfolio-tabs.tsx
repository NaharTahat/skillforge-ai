"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/portfolio", label: "Overview", exact: true },
  { href: "/dashboard/portfolio/edit", label: "Profile & sections" },
  { href: "/dashboard/portfolio/projects", label: "Projects" },
  { href: "/dashboard/portfolio/skills", label: "Skills" },
  { href: "/dashboard/portfolio/settings", label: "Public settings" },
] as const;

export function PortfolioTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Portfolio sections" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b">
        {TABS.map((tab) => {
          const active = "exact" in tab ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-brand font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
