import type { ProjectListItem } from "@/lib/projects/types";

export interface ClientListItem {
  id: string;
  name: string;
  projectCount: number;
  activeProjectCount: number;
  types: string[];
  totalPlannedRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
}

export interface ClientOption {
  id: string;
  name: string;
}

export interface ClientDetail {
  id: string;
  name: string;
  projects: ProjectListItem[];
}
