import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { siteConfig } from "@/lib/config/site";

const footerLinks = [
  {
    heading: "Product",
    links: [
      { label: "CV Analyzer", href: "/#features" },
      { label: "Job Match", href: "/#job-match" },
      { label: "AI Interview", href: "/#interview" },
      { label: "Skill Passport", href: "/#passport" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}</p>
        </div>
        {footerLinks.map((group) => (
          <div key={group.heading}>
            <h3 className="text-sm font-medium">{group.heading}</h3>
            <ul className="mt-3 space-y-0.5">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-block rounded-sm py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>AI insights are guidance, not guarantees of employment outcomes.</p>
        </div>
      </div>
    </footer>
  );
}
