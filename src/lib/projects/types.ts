export interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  type: string;
  active: boolean;
  status: "Quoted" | "Contract Sent" | "Under Contract" | null;
  hours: number;
  totalCost: number;
  hasUnknownRate: boolean;
  plannedRevenue: number | null;
  amountPaid: number;
  outstandingBalance: number;
}

export interface ScopeTagPercent {
  id: string;
  name: string;
  /** Share of the project's total contract value, 0-1. Should sum to 1 across a project's tags. */
  percentOfRevenue: number | null;
}

export interface MilestoneRow {
  id: string;
  name: string;
  sequenceOrder: number;
  dueDate: string | null;
  amountDue: number | null;
  paidDate: string | null;
  amountPaid: number | null;
  status: string;
}

export interface ProjectHourRow {
  subcontractorId: string;
  subcontractorName: string;
  hours: number;
  rate: number | null;
  allocatedHours: number | null;
  cost: number | null;
  paidHours: number;
  paidCost: number;
  pendingHours: number;
  pendingCost: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  clientName: string;
  type: string;
  state: string | null;
  active: boolean;
  status: "Quoted" | "Contract Sent" | "Under Contract" | null;
  notes: string | null;
  referralSourceName: string | null;
  contractSignedDate: string | null;
  contractValue: number | null;
  billingMethod: string | null;
  hourlyRate: number | null;
  fixedFeeAmount: number | null;
  addonHours: number | null;
  addonHourlyRate: number | null;
  furnitureCommissionRate: number | null;
  furnitureSaleTotal: number | null;
  startDate: string | null;
  targetCompletionDate: string | null;
  actualCompletionDate: string | null;
  scopeTags: ScopeTagPercent[];
  milestones: MilestoneRow[];
  hoursByPerson: ProjectHourRow[];
  totalCollected: number;
  totalCost: number;
  hasUnknownRate: boolean;
}
