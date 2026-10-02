"use client";

import { Logo } from "@/components/layout/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { dashboardNav, secondaryNav } from "@/lib/config/navigation";

/** Shared between the desktop sidebar and the mobile sheet. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo href="/dashboard" />
      </div>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
        <div>
          <p className="mb-2 px-3 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
            Workspace
          </p>
          <SidebarNav items={dashboardNav} onNavigate={onNavigate} />
        </div>
        <div className="mt-auto pb-4">
          <SidebarNav items={secondaryNav} onNavigate={onNavigate} />
        </div>
      </nav>
    </div>
  );
}
