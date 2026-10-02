"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  items: NavItem[];
  /** Called after navigation, e.g. to close the mobile sheet. */
  onNavigate?: () => void;
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {items.map(({ title, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary"
                />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-sidebar-primary" : "group-hover:text-sidebar-foreground",
                )}
              />
              {title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
