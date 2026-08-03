import type { ProjectType, ReferralSource, RevenueRow } from "./types";

export const PROJECT_TYPES: ProjectType[] = ["Residential", "Commercial", "Furniture"];

export function distinctYears(rows: RevenueRow[]): number[] {
  return Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
}

export function yearTotal(rows: RevenueRow[], year: number): number {
  return rows.filter((r) => r.year === year).reduce((s, r) => s + r.amount, 0);
}

export function yoyDeltaPct(current: number, prior: number): number | null {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

export function monthlyTotalsForYear(rows: RevenueRow[], year: number): number[] {
  const totals = new Array(12).fill(0);
  for (const r of rows) {
    if (r.year === year) totals[r.month - 1] += r.amount;
  }
  return totals;
}

export function monthlyByTypeForYear(rows: RevenueRow[], year: number): Record<ProjectType, number[]> {
  const result: Record<ProjectType, number[]> = {
    Residential: new Array(12).fill(0),
    Commercial: new Array(12).fill(0),
    Furniture: new Array(12).fill(0),
  };
  for (const r of rows) {
    if (r.year === year) result[r.type][r.month - 1] += r.amount;
  }
  return result;
}

export function yearlyTotalsByType(rows: RevenueRow[], year: number): Record<ProjectType, number> {
  const result: Record<ProjectType, number> = { Residential: 0, Commercial: 0, Furniture: 0 };
  for (const r of rows) {
    if (r.year === year) result[r.type] += r.amount;
  }
  return result;
}

export function ytdTotalsByType(rows: RevenueRow[], year: number, throughMonth: number): Record<ProjectType, number> {
  const result: Record<ProjectType, number> = { Residential: 0, Commercial: 0, Furniture: 0 };
  for (const r of rows) {
    if (r.year === year && r.month <= throughMonth) result[r.type] += r.amount;
  }
  return result;
}

export function allTimeTotalsByType(rows: RevenueRow[]): Record<ProjectType, number> {
  const result: Record<ProjectType, number> = { Residential: 0, Commercial: 0, Furniture: 0 };
  for (const r of rows) {
    result[r.type] += r.amount;
  }
  return result;
}

export interface ProjectMonthlyTotal {
  projectId: string;
  projectName: string;
  monthly: number[];
  total: number;
}

export function projectTotalsForYearAndType(
  rows: RevenueRow[],
  year: number,
  type: ProjectType
): ProjectMonthlyTotal[] {
  const byProject = new Map<string, ProjectMonthlyTotal>();
  for (const r of rows) {
    if (r.year !== year || r.type !== type) continue;
    if (!byProject.has(r.projectId)) {
      byProject.set(r.projectId, {
        projectId: r.projectId,
        projectName: r.projectName,
        monthly: new Array(12).fill(0),
        total: 0,
      });
    }
    const entry = byProject.get(r.projectId)!;
    entry.monthly[r.month - 1] += r.amount;
    entry.total += r.amount;
  }
  return Array.from(byProject.values()).sort((a, b) => b.total - a.total);
}

export interface ReferralTotal {
  id: string;
  name: string;
  total: number;
  byYear: Record<number, number>;
}

export function referralTotals(rows: RevenueRow[], referralSources: ReferralSource[]): ReferralTotal[] {
  const nameById = new Map(referralSources.map((r) => [r.id, r.name]));
  const totals = new Map<string, ReferralTotal>();

  for (const r of rows) {
    if (!r.referralSourceId) continue;
    const name = nameById.get(r.referralSourceId) ?? "Unknown";
    if (!totals.has(r.referralSourceId)) {
      totals.set(r.referralSourceId, { id: r.referralSourceId, name, total: 0, byYear: {} });
    }
    const entry = totals.get(r.referralSourceId)!;
    entry.total += r.amount;
    entry.byYear[r.year] = (entry.byYear[r.year] ?? 0) + r.amount;
  }

  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}
