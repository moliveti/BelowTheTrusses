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
