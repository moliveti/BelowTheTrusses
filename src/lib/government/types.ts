export type OpportunityCategory = "interior_design_architecture" | "furniture_acquisition";
export type PursuitStatus = "watching" | "pursuing" | "submitted" | "declined" | "lost" | "won";

export type OpportunityState = "GA" | "FL";

export interface GovernmentOpportunity {
  id: string;
  state: OpportunityState;
  category: OpportunityCategory;
  title: string;
  agencyName: string;
  governmentType: string | null;
  status: string;
  postingDate: string | null;
  closingDate: string | null;
  detailUrl: string;
  fitScore: number | null;
  pursuitStatus: PursuitStatus | null;
}

export type LeadSector = "commercial_bd_target" | "institutional_pipeline";

export interface MarketIntelLead {
  id: string;
  sector: LeadSector;
  state: OpportunityState;
  title: string;
  description: string | null;
  organizations: { name: string; role: string }[];
  estimatedValue: number | null;
  location: string | null;
  whyBttFits: string | null;
  sourceUrl: string;
  fitScore: number;
  weekOf: string;
}

export interface MarketIntelRun {
  weekOf: string;
  searchRequests: number;
  aiSummaryCalls: number;
  estimatedCostUsd: number;
  status: "running" | "completed" | "failed";
  errorSummary: string | null;
}

/** Source-agnostic shape both the GPR and MFMP fetchers normalize into, before category/fit-score/upsert. */
export interface RawOpportunity {
  externalId: string;
  title: string;
  agencyName: string;
  governmentType: string | null;
  status: string;
  postingDate: string | null;
  closingDate: string | null;
  detailUrl: string;
}
