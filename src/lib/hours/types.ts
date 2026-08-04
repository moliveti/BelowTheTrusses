export interface TimeEntry {
  id: string;
  subcontractorId: string;
  subcontractorName: string;
  projectId: string;
  projectName: string;
  workDate: string; // YYYY-MM-DD
  hours: number;
  workDescription: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  type: string;
}

export interface SubcontractorProfile {
  id: string;
  name: string;
  specialty: string | null;
}

export interface SubcontractorOption {
  id: string;
  name: string;
}

export interface Assignment {
  projectId: string;
  subcontractorId: string;
  hourlyRate: number | null;
  allocatedHours: number | null;
}

export type ProjectTypeName = "Residential" | "Commercial" | "Furniture";

export interface SubcontractorRates {
  id: string;
  name: string;
  defaultHourlyRate: number | null;
  typeRates: Partial<Record<ProjectTypeName, number>>;
}
