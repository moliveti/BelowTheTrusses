import type { Assignment, TimeEntry } from "./types";

export interface CostRow {
  projectId: string;
  projectName: string;
  subcontractorId: string;
  subcontractorName: string;
  hours: number;
  rate: number | null;
  allocatedHours: number | null;
  cost: number | null;
}

export function buildCostRows(entries: TimeEntry[], assignments: Assignment[]): CostRow[] {
  const assignmentByPair = new Map<string, Assignment>();
  for (const a of assignments) assignmentByPair.set(`${a.projectId}::${a.subcontractorId}`, a);

  const hoursByPair = new Map<string, { projectName: string; subcontractorName: string; hours: number }>();
  for (const e of entries) {
    const key = `${e.projectId}::${e.subcontractorId}`;
    if (!hoursByPair.has(key)) {
      hoursByPair.set(key, { projectName: e.projectName, subcontractorName: e.subcontractorName, hours: 0 });
    }
    hoursByPair.get(key)!.hours += e.hours;
  }

  const rows: CostRow[] = [];
  for (const [key, v] of hoursByPair) {
    const [projectId, subcontractorId] = key.split("::");
    const assignment = assignmentByPair.get(key);
    const rate = assignment?.hourlyRate ?? null;
    rows.push({
      projectId,
      projectName: v.projectName,
      subcontractorId,
      subcontractorName: v.subcontractorName,
      hours: v.hours,
      rate,
      allocatedHours: assignment?.allocatedHours ?? null,
      cost: rate !== null ? v.hours * rate : null,
    });
  }
  return rows;
}
