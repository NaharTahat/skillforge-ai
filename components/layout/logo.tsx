import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config/site";

type LogoProps = {
  href?: string;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-8 place-items-center rounded-lg bg-linear-to-br from-brand to-brand-2 shadow-[0_0_24px_-6px] shadow-brand/60",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-4.5 text-primary-foreground" fill="none">
        <path
          d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", className, showWordmark = true, wordmarkClassName }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={`${siteConfig.name} home`}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark />
      {showWordmark && (
        <span aria-hidden className={cn("text-[15px]", wordmarkClassName)}>
          SkillForge<span className="text-muted-foreground"> AI</span>
        </span>
      )}
    </Link>
  );
}
