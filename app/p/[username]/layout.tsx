import { PublicFooter, PublicHeader } from "@/components/public-portfolio/public-shell";

export default function PublicPortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </>
  );
}
