import type { Assignment, TimeEntry } from "./types";

export interface CostRow {
  projectId: string;
  projectName: string;
  subcontractorId: string;
  subcontractorName: string;
  hours: number;
  rate: number | null;
  rateVaries: boolean;
  allocatedHours: number | null;
  cost: number | null;
  hasUnknownRate: boolean;
}

// Cost is computed per-entry using each entry's own frozen hourly_rate
// (captured at log time — see 0009_rate_snapshot.sql), never a live lookup
// of the current default/assignment rate, so later rate changes never
// retroactively re-cost hours already logged.
export function buildCostRows(entries: TimeEntry[], assignments: Assignment[]): CostRow[] {
  const allocatedByPair = new Map<string, number | null>();
  for (const a of assignments) allocatedByPair.set(`${a.projectId}::${a.subcontractorId}`, a.allocatedHours);

  const byPair = new Map<
    string,
    { projectId: string; projectName: string; subcontractorId: string; subcontractorName: string; hours: number; cost: number; hasUnknownRate: boolean; rates: Set<number> }
  >();

  for (const e of entries) {
    const key = `${e.projectId}::${e.subcontractorId}`;
    if (!byPair.has(key)) {
      byPair.set(key, {
        projectId: e.projectId,
        projectName: e.projectName,
        subcontractorId: e.subcontractorId,
        subcontractorName: e.subcontractorName,
        hours: 0,
        cost: 0,
        hasUnknownRate: false,
        rates: new Set(),
      });
    }
    const row = byPair.get(key)!;
    row.hours += e.hours;
    if (e.hourlyRate === null) {
      row.hasUnknownRate = true;
    } else {
      row.cost += e.hours * e.hourlyRate;
      row.rates.add(e.hourlyRate);
    }
  }

  const rows: CostRow[] = [];
  for (const [key, v] of byPair) {
    const rateVaries = v.rates.size > 1;
    rows.push({
      projectId: v.projectId,
      projectName: v.projectName,
      subcontractorId: v.subcontractorId,
      subcontractorName: v.subcontractorName,
      hours: v.hours,
      rate: rateVaries ? null : (v.rates.values().next().value ?? null),
      rateVaries,
      allocatedHours: allocatedByPair.get(key) ?? null,
      // Sum of what's known; hasUnknownRate flags it as understated rather
      // than hiding the partial total, matching the rest of the app.
      cost: v.hasUnknownRate && v.rates.size === 0 ? null : v.cost,
      hasUnknownRate: v.hasUnknownRate,
    });
  }
  return rows;
}
