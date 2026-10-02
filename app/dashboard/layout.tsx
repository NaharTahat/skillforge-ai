import type { Metadata } from "next";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SidebarContent } from "@/components/dashboard/sidebar-content";
import { displayNameOf, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  // Authoritative server-side check (the proxy only does an optimistic one).
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <DashboardHeader
          user={{ displayName: displayNameOf(user), email: user.email, image: user.image }}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
