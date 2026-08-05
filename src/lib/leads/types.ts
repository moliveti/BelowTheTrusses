export type LeadStatus =
  | "New Prospect"
  | "Quote Sent"
  | "Contract Submitted"
  | "Signed Contract"
  | "Lost"
  | "Business Not Materialized";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  state: string | null;
  budgetRange: string | null;
  /** 1st-of-month date strings marking a tentative start/end window, not firm commitments. */
  timelineStartMonth: string | null;
  timelineEndMonth: string | null;
  referralSourceId: string | null;
  referralSourceName: string | null;
  notes: string | null;
  scopeTags: string[];
  status: LeadStatus;
  lastContactedDate: string | null;
  createdAt: string;
  convertedSowId: string | null;
  convertedProjectId: string | null;
}
