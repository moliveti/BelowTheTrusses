export interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  type: string;
  active: boolean;
  hours: number;
  totalCost: number;
  hasUnknownRate: boolean;
  plannedRevenue: number | null;
  amountPaid: number;
  outstandingBalance: number;
}

export interface ScopeTagAmount {
  name: string;
  amount: number | null;
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
}

export interface ProjectDetail {
  id: string;
  name: string;
  clientName: string;
  type: string;
  state: string | null;
  active: boolean;
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
  scopeTags: ScopeTagAmount[];
  milestones: MilestoneRow[];
  hoursByPerson: ProjectHourRow[];
  totalCollected: number;
  totalCost: number;
  hasUnknownRate: boolean;
}
