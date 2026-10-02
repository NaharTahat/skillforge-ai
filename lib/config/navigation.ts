import {
  BadgeCheck,
  Briefcase,
  ClipboardCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessagesSquare,
  Route,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const dashboardNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your career readiness at a glance.",
  },
  {
    title: "CV Analyzer",
    href: "/dashboard/cv",
    icon: FileText,
    description: "Upload your CV and get a structured breakdown of strengths and gaps.",
  },
  {
    title: "Job Match",
    href: "/dashboard/job-match",
    icon: Briefcase,
    description: "Compare your CV against a job description and see what's missing.",
  },
  {
    title: "Career Roadmap",
    href: "/dashboard/roadmap",
    icon: Route,
    description: "A step-by-step learning path toward your target role.",
  },
  {
    title: "AI Interview",
    href: "/dashboard/interview",
    icon: MessagesSquare,
    description: "Practice technical and behavioral interviews with scored feedback.",
  },
  {
    title: "Assessments",
    href: "/dashboard/assessments",
    icon: ClipboardCheck,
    description: "Measure your level in Python, SQL, ML, JavaScript and more.",
  },
  {
    title: "Portfolio",
    href: "/dashboard/portfolio",
    icon: FolderKanban,
    description: "Showcase the projects that prove your skills.",
  },
  {
    title: "Skill Passport",
    href: "/dashboard/skill-passport",
    icon: BadgeCheck,
    description: "Your skills, with the evidence behind each one, ready to share.",
  },
];

export const secondaryNav: NavItem[] = [
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserRound,
    description: "Your personal details, career goal and experience level.",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Account security, connected accounts and privacy.",
  },
];

export const marketingNav = [
  { title: "Features", href: "/#features" },
  { title: "How it works", href: "/#how-it-works" },
  { title: "Pricing", href: "/#pricing" },
  { title: "FAQ", href: "/#faq" },
] as const;
