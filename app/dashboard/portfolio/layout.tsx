import { PortfolioTabs } from "@/components/portfolio/portfolio-tabs";

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PortfolioTabs />
      {children}
    </div>
  );
}
