import type { TimeEntry } from "@/lib/hours/types";
import { costByContractor, costByProject, type CostBreakdownRow } from "@/lib/hours/productivity";

/** The slice of a project row this needs -- matches ProjectListItem. */
export interface ProjectRevenueInput {
  id: string;
  plannedRevenue: number | null;
  amountPaid: number;
  outstandingBalance: number;
}

/** The slice of a payment-schedule row this needs -- matches PaymentRow. */
export interface PaymentInput {
  projectId: string;
  dueDate: string | null;
  amountDue: number | null;
  amountPaid: number | null;
}

/** "all" is every year together; a number is one calendar year. */
export type ProfitYear = "all" | number;

export interface ProjectRevenue {
  contractValue: number | null;
  collected: number;
  notYetPaid: number;
  total: number;
}

const yearOf = (date: string) => Number(date.slice(0, 4));

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

/** Revenue for one calendar year: the payments due in that year, the same grouping the Payment Schedules page uses. */
function projectRevenueForYear(contractValue: number | null, payments: PaymentInput[], year: number): ProjectRevenue {
  let total = 0;
  let collected = 0;
  let notYetPaid = 0;
  for (const p of payments) {
    if (!p.dueDate || yearOf(p.dueDate) !== year) continue;
    const due = p.amountDue ?? 0;
    const paid = p.amountPaid ?? 0;
    total += due;
    collected += paid;
    notYetPaid += Math.max(0, due - paid);
  }
  return { contractValue, collected, notYetPaid, total };
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

/** Years worth offering in the filter: every year with logged hours or a payment due, plus the current one. */
export function profitYears(entries: TimeEntry[], payments: PaymentInput[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const e of entries) years.add(yearOf(e.workDate));
  for (const p of payments) if (p.dueDate) years.add(yearOf(p.dueDate));
  return Array.from(years).sort((a, b) => a - b);
}

/**
 * One row per project that has ever had hours logged, joining its contractor
 * cost to its revenue. For a single year, cost is the hours worked in that
 * year and revenue is the payments due in it; a project with neither in that
 * year is left out.
 */
export function buildProjectProfitRows(
  entries: TimeEntry[],
  projects: ProjectRevenueInput[],
  payments: PaymentInput[] = [],
  year: ProfitYear = "all"
): ProjectProfitRow[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const paymentsByProject = new Map<string, PaymentInput[]>();
  for (const p of payments) {
    if (!paymentsByProject.has(p.projectId)) paymentsByProject.set(p.projectId, []);
    paymentsByProject.get(p.projectId)!.push(p);
  }

  const scopedEntries = year === "all" ? entries : entries.filter((e) => yearOf(e.workDate) === year);
  const entriesByProject = new Map<string, TimeEntry[]>();
  for (const e of scopedEntries) {
    if (!entriesByProject.has(e.projectId)) entriesByProject.set(e.projectId, []);
    entriesByProject.get(e.projectId)!.push(e);
  }
  const costById = new Map(costByProject(scopedEntries).map((r) => [r.id, r]));

  const projectNames = new Map<string, string>();
  for (const e of entries) projectNames.set(e.projectId, e.projectName);

  const rows: ProjectProfitRow[] = [];
  for (const [projectId, name] of projectNames) {
    const project = projectById.get(projectId);
    const revenue =
      year === "all"
        ? projectRevenue(project)
        : projectRevenueForYear(project?.plannedRevenue ?? null, paymentsByProject.get(projectId) ?? [], year);
    const cost = costById.get(projectId);
    const hours = cost?.hours ?? 0;
    const costTotal = cost?.cost ?? 0;
    if (year !== "all" && hours === 0 && revenue.total === 0 && revenue.collected === 0) continue;

    rows.push({
      projectId,
      name,
      ...revenue,
      hours,
      cost: costTotal,
      hasUnknownRate: cost?.hasUnknownRate ?? false,
      profit: revenue.total - costTotal,
      contractors: costByContractor(entriesByProject.get(projectId) ?? []),
    });
  }

  return rows.sort((a, b) => b.cost - a.cost || b.total - a.total || a.name.localeCompare(b.name));
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
