import type { DashboardOverview } from "@/types/dashboard";
import type { DashboardService } from "./types";

const HOUR = 60 * 60 * 1000;

/**
 * Static sample data for UI development. This is NOT AI output and is
 * labelled as sample data in the UI via `source: "mock"`.
 */
export const mockDashboardService: DashboardService = {
  async getOverview() {
    const now = Date.now();
    const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();

    const overview: DashboardOverview = {
      source: "mock",
      careerReadiness: 74,
      careerGoal: "AI Engineer",
      skills: [
        { name: "Python", proficiency: 90 },
        { name: "Machine Learning", proficiency: 72 },
        { name: "SQL", proficiency: 55 },
        { name: "Cloud", proficiency: 31 },
      ],
      cv: { state: "analyzed", fileName: "alex-kim-cv.pdf", score: 78, analyzedAt: ago(26) },
      jobMatches: {
        strong: 3,
        potential: 7,
        topMatch: { title: "ML Engineer", company: "Northwind Labs", matchPercent: 84 },
      },
      recommendedSkills: [
        { name: "Docker", reason: "Required to ship models to production", demandCount: 6 },
        { name: "AWS", reason: "Most requested cloud platform in your matches", demandCount: 5 },
        { name: "MLOps", reason: "Bridges your ML and engineering experience", demandCount: 4 },
      ],
      roadmap: {
        goal: "AI Engineer",
        completedPercent: 42,
        completedItems: 4,
        totalItems: 10,
        nextItem: { title: "Deep Learning fundamentals", estimatedHours: 30 },
      },
      interview: {
        latestScore: 81,
        sessionsCompleted: 6,
        history: [
          { label: "S1", score: 58 },
          { label: "S2", score: 63 },
          { label: "S3", score: 61 },
          { label: "S4", score: 70 },
          { label: "S5", score: 76 },
          { label: "S6", score: 81 },
        ],
      },
      recentActivity: [
        {
          id: "a1",
          kind: "interview",
          title: "Completed a technical interview — 81%",
          occurredAt: ago(3),
        },
        { id: "a2", kind: "roadmap", title: "Finished “SQL for analytics”", occurredAt: ago(20) },
        { id: "a3", kind: "cv", title: "CV analyzed — score 78", occurredAt: ago(26) },
        {
          id: "a4",
          kind: "job",
          title: "Matched against ML Engineer at Northwind Labs",
          occurredAt: ago(50),
        },
        {
          id: "a5",
          kind: "assessment",
          title: "Python assessment — Advanced",
          occurredAt: ago(96),
        },
      ],
    };

    return overview;
  },
};
