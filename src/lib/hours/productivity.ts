import type { TimeEntry } from "./types";

export interface PersonYearData {
  personId: string;
  personName: string;
  hoursMonthly: number[]; // 12
  costMonthly: number[]; // 12 — 0 where hours exist but rate is unknown
  hasUnknownRate: boolean;
}

function workYearMonth(dateStr: string): { year: number; month: number } {
  const d = new Date(dateStr);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function distinctYearsFromEntries(entries: TimeEntry[]): number[] {
  return Array.from(new Set(entries.map((e) => workYearMonth(e.workDate).year))).sort((a, b) => a - b);
}

// Cost uses each entry's own hourly_rate, frozen at log time
// (0009_rate_snapshot.sql), not a live lookup — never retroactive.
export function personBreakdownForYear(entries: TimeEntry[], year: number): PersonYearData[] {
  const byPerson = new Map<string, PersonYearData>();

  for (const e of entries) {
    const { year: y, month } = workYearMonth(e.workDate);
    if (y !== year) continue;
    if (!byPerson.has(e.subcontractorId)) {
      byPerson.set(e.subcontractorId, {
        personId: e.subcontractorId,
        personName: e.subcontractorName,
        hoursMonthly: new Array(12).fill(0),
        costMonthly: new Array(12).fill(0),
        hasUnknownRate: false,
      });
    }
    const row = byPerson.get(e.subcontractorId)!;
    row.hoursMonthly[month - 1] += e.hours;
    if (e.hourlyRate === null) row.hasUnknownRate = true;
    else row.costMonthly[month - 1] += e.hours * e.hourlyRate;
  }

  return Array.from(byPerson.values()).sort(
    (a, b) => b.hoursMonthly.reduce((s, v) => s + v, 0) - a.hoursMonthly.reduce((s, v) => s + v, 0)
  );
}

export function sumMonthly(rows: PersonYearData[], key: "hoursMonthly" | "costMonthly"): number[] {
  const totals = new Array(12).fill(0);
  for (const r of rows) {
    r[key].forEach((v, i) => (totals[i] += v));
  }
  return totals;
}

export interface CostBreakdownRow {
  id: string;
  name: string;
  hours: number;
  cost: number;
  /** cost/hours — null when there's no hours to divide by. */
  avgRate: number | null;
  hasUnknownRate: boolean;
}

function accumulate(entries: TimeEntry[], keyOf: (e: TimeEntry) => string, nameOf: (e: TimeEntry) => string): CostBreakdownRow[] {
  const byKey = new Map<string, CostBreakdownRow>();
  for (const e of entries) {
    const key = keyOf(e);
    if (!byKey.has(key)) {
      byKey.set(key, { id: key, name: nameOf(e), hours: 0, cost: 0, avgRate: null, hasUnknownRate: false });
    }
    const row = byKey.get(key)!;
    row.hours += e.hours;
    if (e.hourlyRate === null) row.hasUnknownRate = true;
    else row.cost += e.hours * e.hourlyRate;
  }
  const rows = Array.from(byKey.values());
  for (const r of rows) r.avgRate = r.hours > 0 ? r.cost / r.hours : null;
  return rows.sort((a, b) => b.cost - a.cost);
}

/** Cost/hours rolled up per project — reveals which projects are actually expensive to staff, not just which have the most hours logged. */
export function costByProject(entries: TimeEntry[]): CostBreakdownRow[] {
  return accumulate(entries, (e) => e.projectId, (e) => e.projectName);
}

/** Cost/hours rolled up per contractor — the effective blended rate each person actually costs across all their work, not just their nominal rate. */
export function costByContractor(entries: TimeEntry[]): CostBreakdownRow[] {
  return accumulate(entries, (e) => e.subcontractorId, (e) => e.subcontractorName);
}

export interface MonthCostRow {
  year: number;
  month: number; // 1-12
  hours: number;
  cost: number;
  avgRate: number | null;
}

/** Cost/hours rolled up per calendar month, across every project and contractor — the trend line for "are we spending more per hour over time." */
export function costByMonth(entries: TimeEntry[]): MonthCostRow[] {
  const byKey = new Map<string, MonthCostRow>();
  for (const e of entries) {
    const { year, month } = workYearMonth(e.workDate);
    const key = `${year}-${month}`;
    if (!byKey.has(key)) byKey.set(key, { year, month, hours: 0, cost: 0, avgRate: null });
    const row = byKey.get(key)!;
    row.hours += e.hours;
    if (e.hourlyRate !== null) row.cost += e.hours * e.hourlyRate;
  }
  const rows = Array.from(byKey.values());
  for (const r of rows) r.avgRate = r.hours > 0 ? r.cost / r.hours : null;
  return rows.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
}
