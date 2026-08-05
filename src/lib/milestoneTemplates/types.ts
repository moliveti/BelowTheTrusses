export interface MilestoneTemplateStep {
  id: string;
  name: string;
  sequenceOrder: number;
  percentOfTotal: number;
  offsetDays: number;
}

export interface MilestoneTemplateGroup {
  projectType: string;
  templateName: string;
  steps: MilestoneTemplateStep[];
}
