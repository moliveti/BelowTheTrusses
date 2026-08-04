export type LeadStatus = "New" | "Contacted" | "Qualified" | "Converted" | "Lost";

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  state: string | null;
  budgetRange: string | null;
  timeline: string | null;
  referralSourceId: string | null;
  referralSourceName: string | null;
  notes: string | null;
  status: LeadStatus;
  lastContactedDate: string | null;
  createdAt: string;
  convertedSowId: string | null;
  convertedProjectId: string | null;
}
