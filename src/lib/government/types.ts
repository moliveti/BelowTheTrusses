export type OpportunityCategory = "interior_design_architecture" | "furniture_acquisition";
export type PursuitStatus = "watching" | "pursuing" | "submitted" | "declined" | "lost" | "won";

export interface GovernmentOpportunity {
  id: string;
  category: OpportunityCategory;
  title: string;
  agencyName: string;
  governmentType: string | null;
  status: string;
  postingDate: string | null;
  closingDate: string | null;
  detailUrl: string;
  pursuitStatus: PursuitStatus | null;
}
