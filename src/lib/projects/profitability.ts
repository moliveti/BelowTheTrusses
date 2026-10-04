import type { TimeEntry } from "@/lib/hours/types";
import { costByContractor, costByProject, type CostBreakdownRow } from "@/lib/hours/productivity";

/** The slice of a project row this needs -- matches ProjectListItem. */
export interface ProjectRevenueInput {
  id: string;
  plannedRevenue: number | null;
  amountPaid: number;
  outstandingBalance: number;
}

export interface ProjectRevenue {
  contractValue: number | null;
  collected: number;
  notYetPaid: number;
  total: number;
}

/**
 * Total revenue is what the payment schedule adds up to (collected + still
 * owed). A project with no schedule yet falls back to its contract value, so
 * it isn't shown as earning nothing.
 */
export function projectRevenue(p: ProjectRevenueInput | undefined): ProjectRevenue {
  if (!p) return { contractValue: null, collected: 0, notYetPaid: 0, total: 0 };
  const scheduled = p.amountPaid + p.outstandingBalance;
  const total = scheduled > 0 ? scheduled : (p.plannedRevenue ?? 0);
  return {
    contractValue: p.plannedRevenue,
    collected: p.amountPaid,
    notYetPaid: Math.max(0, total - p.amountPaid),
    total,
  };
}

export interface ProjectProfitRow extends ProjectRevenue {
  projectId: string;
  name: string;
  hours: number;
  cost: number;
  hasUnknownRate: boolean;
  /** Total revenue minus contractor cost. */
  profit: number;
  /** Hours and dollars per contractor on this project, biggest cost first. */
  contractors: CostBreakdownRow[];
}

/** One row per project that has hours logged, joining its contractor cost to its revenue. */
export function buildProjectProfitRows(entries: TimeEntry[], projects: ProjectRevenueInput[]): ProjectProfitRow[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const entriesByProject = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    if (!entriesByProject.has(e.projectId)) entriesByProject.set(e.projectId, []);
    entriesByProject.get(e.projectId)!.push(e);
  }

  return costByProject(entries).map((row) => {
    const revenue = projectRevenue(projectById.get(row.id));
    return {
      projectId: row.id,
      name: row.name,
      ...revenue,
      hours: row.hours,
      cost: row.cost,
      hasUnknownRate: row.hasUnknownRate,
      profit: revenue.total - row.cost,
      contractors: costByContractor(entriesByProject.get(row.id) ?? []),
    };
  });
}

export interface ProjectProfitTotals {
  collected: number;
  notYetPaid: number;
  total: number;
  hours: number;
  cost: number;
  profit: number;
}

export function totalProfitRows(rows: ProjectProfitRow[]): ProjectProfitTotals {
  return rows.reduce(
    (t, r) => ({
      collected: t.collected + r.collected,
      notYetPaid: t.notYetPaid + r.notYetPaid,
      total: t.total + r.total,
      hours: t.hours + r.hours,
      cost: t.cost + r.cost,
      profit: t.profit + r.profit,
    }),
    { collected: 0, notYetPaid: 0, total: 0, hours: 0, cost: 0, profit: 0 }
  );
}
