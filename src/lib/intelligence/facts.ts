import type { Lead } from "@/lib/leads/types";
import type { SowRow, RevenueRow } from "@/lib/dashboard/types";
import type { ProjectListItem } from "@/lib/projects/types";
import { monthlyTotalsForYear } from "@/lib/dashboard/aggregate";
import { buildFingerprint, dayBucket, syntheticSourceId } from "./fingerprint";
import type { Signal } from "./types";

const OPEN_LEAD_STATUSES: Lead["status"][] = ["New Prospect", "Quote Sent", "Contract Submitted"];
const AGING_SOW_STATUSES = ["Open", "On Hold", "No Response"];

/** Bare "YYYY-MM-DD" strings parse as UTC midnight, matching how the rest of the app (e.g. LeadsTab staleness) treats date-only fields. */
function daysBetween(from: string, asOf: Date): number {
  return Math.floor((asOf.getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Stale leads
// ---------------------------------------------------------------------------

const STALE_LEAD_BUCKETS = [7, 14, 30];

export function staleLeadSignals(leads: Lead[], asOf: Date): Signal[] {
  const signals: Signal[] = [];
  for (const lead of leads) {
    if (!OPEN_LEAD_STATUSES.includes(lead.status)) continue;
    const days = daysBetween(lead.lastContactedDate ?? lead.createdAt, asOf);
    if (days < STALE_LEAD_BUCKETS[0]) continue;

    const bucket = dayBucket(days, STALE_LEAD_BUCKETS);
    const severity = days >= 30 ? "critical" : days >= 14 ? "high" : "medium";

    signals.push({
      type: "stale_lead",
      sourceTable: "leads",
      sourceId: lead.id,
      title: `Stale lead: ${lead.name}`,
      reason: `No contact recorded in ${days} days (status: ${lead.status}).`,
      severity,
      conditionFingerprint: buildFingerprint("stale_lead", [lead.status, bucket]),
      metricValue: days,
      metricLabel: "days_since_contact",
      context: { leadName: lead.name, status: lead.status, budgetRange: lead.budgetRange },
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Aging SOW / Business Not Materialized
// ---------------------------------------------------------------------------

const AGING_SOW_BUCKETS = [14, 30, 60];

export function agingSowSignals(rows: SowRow[], asOf: Date): Signal[] {
  const signals: Signal[] = [];
  for (const row of rows) {
    if (!AGING_SOW_STATUSES.includes(row.status) || !row.dateSent) continue;
    const days = daysBetween(row.dateSent, asOf);
    if (days < AGING_SOW_BUCKETS[0]) continue;

    const bucket = dayBucket(days, AGING_SOW_BUCKETS);
    const severity = days >= 60 ? "critical" : days >= 30 ? "high" : "medium";

    signals.push({
      type: "aging_sow",
      sourceTable: "sow_sent",
      sourceId: row.id,
      title: `Aging quote: ${row.prospectName}`,
      reason: `Status "${row.status}" for ${days} days${row.proposedFee ? ` — $${row.proposedFee.toLocaleString()} proposed` : ""}.`,
      severity,
      conditionFingerprint: buildFingerprint("aging_sow", [row.status, bucket]),
      metricValue: days,
      metricLabel: "days_since_sent",
      context: { prospectName: row.prospectName, status: row.status, proposedFee: row.proposedFee },
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Milestones (overdue / upcoming)
// ---------------------------------------------------------------------------

export interface MilestoneForIntelligence {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  dueDate: string | null;
  amountDue: number | null;
  amountPaid: number | null;
}

export function overdueMilestoneSignals(milestones: MilestoneForIntelligence[], asOf: Date): Signal[] {
  const signals: Signal[] = [];
  for (const m of milestones) {
    if (!m.dueDate || m.amountDue === null) continue;
    const outstanding = m.amountDue - (m.amountPaid ?? 0);
    if (outstanding <= 0) continue;
    const days = daysBetween(m.dueDate, asOf);
    if (days <= 0) continue; // due today or in the future isn't overdue

    const bucket = dayBucket(days, [1, 14, 30]);
    const severity = days >= 30 ? "critical" : days >= 14 ? "high" : "medium";

    signals.push({
      type: "milestone_overdue",
      sourceTable: "milestones",
      sourceId: m.id,
      title: `Overdue milestone: ${m.projectName}`,
      reason: `"${m.name}" was due ${days} day${days === 1 ? "" : "s"} ago — $${outstanding.toLocaleString()} outstanding.`,
      severity,
      conditionFingerprint: buildFingerprint("milestone_overdue", [bucket]),
      metricValue: days,
      metricLabel: "days_overdue",
      context: { projectId: m.projectId, projectName: m.projectName, milestoneName: m.name, outstanding },
    });
  }
  return signals;
}

export function upcomingMilestoneSignals(milestones: MilestoneForIntelligence[], asOf: Date, withinDays = 14): Signal[] {
  const signals: Signal[] = [];
  for (const m of milestones) {
    if (!m.dueDate || m.amountDue === null) continue;
    const outstanding = m.amountDue - (m.amountPaid ?? 0);
    if (outstanding <= 0) continue;
    const days = daysBetween(m.dueDate, asOf);
    if (days > 0 || days < -withinDays) continue; // days is negative for future dates
    const daysUntil = days === 0 ? 0 : -days; // avoid producing -0 when due today

    const bucket = dayBucket(daysUntil, [0, 4, 8]);
    const severity = daysUntil <= 3 ? "high" : daysUntil <= 7 ? "medium" : "low";

    signals.push({
      type: "milestone_upcoming",
      sourceTable: "milestones",
      sourceId: m.id,
      title: `Upcoming milestone: ${m.projectName}`,
      reason: `"${m.name}" due in ${daysUntil} day${daysUntil === 1 ? "" : "s"} — $${outstanding.toLocaleString()}.`,
      severity,
      conditionFingerprint: buildFingerprint("milestone_upcoming", [bucket]),
      metricValue: daysUntil,
      metricLabel: "days_until_due",
      context: { projectId: m.projectId, projectName: m.projectName, milestoneName: m.name, outstanding },
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Outstanding project balances
// ---------------------------------------------------------------------------

const OUTSTANDING_BALANCE_FLOOR = 500;

export function outstandingBalanceSignals(projects: ProjectListItem[]): Signal[] {
  const signals: Signal[] = [];
  for (const p of projects) {
    if (!p.active || p.outstandingBalance <= OUTSTANDING_BALANCE_FLOOR) continue;

    const severity =
      p.outstandingBalance >= 40000 ? "critical" : p.outstandingBalance >= 15000 ? "high" : p.outstandingBalance >= 5000 ? "medium" : "low";
    const bucket = dayBucket(Math.floor(p.outstandingBalance / 1000), [0, 5, 15, 40]);

    signals.push({
      type: "outstanding_balance",
      sourceTable: "projects",
      sourceId: p.id,
      title: `Outstanding balance: ${p.name}`,
      reason: `$${p.outstandingBalance.toLocaleString()} outstanding on an active project (${p.clientName}).`,
      severity,
      conditionFingerprint: buildFingerprint("outstanding_balance", [bucket]),
      metricValue: p.outstandingBalance,
      metricLabel: "outstanding_dollars",
      context: { projectName: p.name, clientName: p.clientName },
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Forecast concentration (company-level, not tied to one record)
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CONCENTRATION_THRESHOLD = 0.4;

export function forecastConcentrationSignal(forecastRows: RevenueRow[], year: number): Signal | null {
  const monthly = monthlyTotalsForYear(forecastRows, year);
  const total = monthly.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;

  let maxIdx = 0;
  for (let i = 1; i < 12; i++) if (monthly[i] > monthly[maxIdx]) maxIdx = i;
  const share = monthly[maxIdx] / total;
  if (share < CONCENTRATION_THRESHOLD) return null;

  const severity = share >= 0.6 ? "critical" : share >= 0.5 ? "high" : "medium";
  const sharePct = Math.round(share * 100);

  return {
    type: "forecast_concentration",
    sourceTable: "forecast_summary",
    sourceId: syntheticSourceId(`forecast_concentration:${year}`),
    title: `Forecast concentrated in ${MONTH_NAMES[maxIdx]}`,
    reason: `${sharePct}% of this year's remaining forecast ($${Math.round(monthly[maxIdx]).toLocaleString()} of $${Math.round(total).toLocaleString()}) falls in ${MONTH_NAMES[maxIdx]}.`,
    severity,
    conditionFingerprint: buildFingerprint("forecast_concentration", [year, MONTH_NAMES[maxIdx], dayBucket(sharePct, [40, 50, 60])]),
    metricValue: sharePct,
    metricLabel: "concentration_pct",
    context: { year, month: MONTH_NAMES[maxIdx], monthAmount: monthly[maxIdx], totalForecast: total },
  };
}
