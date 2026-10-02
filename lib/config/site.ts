export const siteConfig = {
  name: "SkillForge AI",
  tagline: "Turn your skills into your next opportunity.",
  description:
    "SkillForge AI is a career intelligence platform: analyze your CV, match it against real job descriptions, close skill gaps with a personalized roadmap, and practice interviews.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

/**
 * Central route map. Signed-in visitors who follow getStarted/signIn are
 * redirected to the dashboard by the proxy.
 */
export const routes = {
  home: "/",
  dashboard: "/dashboard",
  getStarted: "/register",
  signIn: "/login",
} as const;
