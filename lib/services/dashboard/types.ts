import type { DashboardOverview } from "@/types/dashboard";

export interface DashboardService {
  getOverview(userId: string): Promise<DashboardOverview>;
}
