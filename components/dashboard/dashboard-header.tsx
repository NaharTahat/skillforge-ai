import { FlaskConical } from "lucide-react";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { UserMenu, type UserMenuUser } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DashboardHeader({ user }: { user: UserMenuUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b glass px-4 sm:px-6">
      <MobileSidebar />
      {/* The sidebar carries the brand on desktop. */}
      <Logo
        href="/dashboard"
        className="ml-1 lg:hidden"
        wordmarkClassName="hidden min-[420px]:inline"
      />
      <div className="flex-1" />
      {/* Stays until dashboard figures come from the user's real data. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            tabIndex={0}
            variant="outline"
            className="gap-1.5 rounded-full px-2.5 py-1 font-normal text-muted-foreground"
          >
            <FlaskConical className="size-3.5" />
            <span className="hidden sm:inline">Preview mode</span>
            <span className="sm:hidden">Preview</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Dashboard figures are sample data until CV analysis and tracking are available.
        </TooltipContent>
      </Tooltip>
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
