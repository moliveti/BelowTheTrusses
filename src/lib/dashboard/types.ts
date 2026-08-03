export type ProjectType = "Residential" | "Commercial" | "Furniture";

export interface RevenueRow {
  year: number;
  month: number; // 1-12
  type: ProjectType;
  amount: number;
  referralSourceId: string | null;
  projectId: string;
  projectName: string;
}

export interface ReferralSource {
  id: string;
  name: string;
  type: string;
}

export interface SowRow {
  dateSent: string | null;
  prospectName: string;
  proposedFee: number | null;
  status: string;
  notes: string | null;
}

export interface DashboardData {
  collected: RevenueRow[];
  /** Contracted but not yet paid: milestones due (amount_due > amount_paid), by due-date month. */
  forecast: RevenueRow[];
  referralSources: ReferralSource[];
  sow: SowRow[];
}

export type RevenueMode = "revenue" | "revenue_forecast";
