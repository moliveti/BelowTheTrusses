export type ProjectType = "Residential" | "Commercial" | "Furniture";

export interface RevenueRow {
  year: number;
  month: number; // 1-12
  type: ProjectType;
  amount: number;
  referralSourceId: string | null;
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
  committed: RevenueRow[];
  referralSources: ReferralSource[];
  sow: SowRow[];
}

export type RevenueMode = "collected" | "committed";
