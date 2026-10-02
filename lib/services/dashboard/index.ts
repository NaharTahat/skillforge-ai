import "server-only";
import { mockDashboardService } from "./mock";
import type { DashboardService } from "./types";

/**
 * Single swap point: replace with a Prisma-backed implementation once
 * authentication and feature data exist (Phase 2+).
 */
export const dashboardService: DashboardService = mockDashboardService;

export type { DashboardService };
