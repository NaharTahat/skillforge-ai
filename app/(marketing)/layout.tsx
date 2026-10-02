import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { auth } from "@/lib/auth/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Cookie-only check (no database access) to choose header actions.
  const session = await auth();

  return (
    <>
      <SiteHeader isAuthenticated={Boolean(session?.user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
