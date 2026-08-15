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

// Past this age, a quote realistically isn't converting — the recommendation
// stops asking to "follow up again" and instead suggests closing it out
// (reclassify to Declined), per the owner's explicit call: "business not
// materialized is not going to come back."
const AGING_SOW_CLOSEOUT_DAYS = 120;

export function agingSowSignals(rows: SowRow[], asOf: Date): Signal[] {
  const signals: Signal[] = [];
  for (const row of rows) {
    if (!AGING_SOW_STATUSES.includes(row.status) || !row.dateSent) continue;
    const days = daysBetween(row.dateSent, asOf);
    if (days < AGING_SOW_BUCKETS[0]) continue;

    const closeoutSuggested = days >= AGING_SOW_CLOSEOUT_DAYS;
    // Bucketed coarsely past the closeout line — the fingerprint shouldn't
    // keep drifting once we're just saying "this is old, close it," so every
    // closeout-eligible day shares one fingerprint instead of one per bucket.
    const bucket = closeoutSuggested ? "closeout" : dayBucket(days, AGING_SOW_BUCKETS);
    const severity = closeoutSuggested ? "critical" : days >= 30 ? "high" : "medium";
    const reason = closeoutSuggested
      ? `No response in ${days} days — this isn't likely to close. Consider declining it.`
      : `Status "${row.status}" for ${days} days${row.proposedFee ? ` — $${row.proposedFee.toLocaleString()} proposed` : ""}.`;

    signals.push({
      type: "aging_sow",
      sourceTable: "sow_sent",
      sourceId: row.id,
      title: `Aging quote: ${row.prospectName}`,
      reason,
      severity,
      conditionFingerprint: buildFingerprint("aging_sow", [row.status, bucket]),
      metricValue: days,
      metricLabel: "days_since_sent",
      context: { prospectName: row.prospectName, status: row.status, proposedFee: row.proposedFee, closeoutSuggested },
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

function daysUntilMonthEnd(asOf: Date): number {
  const monthEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1));
  return Math.floor((monthEnd.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));
}

/** Not due yet, but due within the next 7 days — this week, act soon. */
export function milestonesDueThisWeek(milestones: MilestoneForIntelligence[], asOf: Date): Signal[] {
  return dueSoonMilestoneSignals(milestones, asOf, 0, 7, "milestone_due_this_week", "Due this week");
}

/**
 * Due later than this week but still within the current calendar month —
 * green, on the radar, no action needed today. Nothing further out than
 * month-end is surfaced at all: per the owner, a bill due in November isn't
 * a "what should we do today, mid-August" item.
 */
export function milestonesDueThisMonth(milestones: MilestoneForIntelligence[], asOf: Date): Signal[] {
  const monthEnd = daysUntilMonthEnd(asOf);
  if (monthEnd <= 7) return [];
  return dueSoonMilestoneSignals(milestones, asOf, 8, monthEnd, "milestone_due_this_month", "Due later this month");
}

function dueSoonMilestoneSignals(
  milestones: MilestoneForIntelligence[],
  asOf: Date,
  minDaysUntil: number,
  maxDaysUntil: number,
  type: string,
  label: string
): Signal[] {
  const signals: Signal[] = [];
  for (const m of milestones) {
    if (!m.dueDate || m.amountDue === null) continue;
    const outstanding = m.amountDue - (m.amountPaid ?? 0);
    if (outstanding <= 0) continue;
    const days = daysBetween(m.dueDate, asOf);
    if (days > 0) continue; // already due/overdue — handled by overdueMilestoneSignals
    const daysUntil = days === 0 ? 0 : -days; // avoid producing -0 when due today
    if (daysUntil < minDaysUntil || daysUntil > maxDaysUntil) continue;

    signals.push({
      type,
      sourceTable: "milestones",
      sourceId: m.id,
      title: `${label}: ${m.projectName}`,
      reason: `"${m.name}" due in ${daysUntil} day${daysUntil === 1 ? "" : "s"} — $${outstanding.toLocaleString()}.`,
      severity: type === "milestone_due_this_week" ? "medium" : "low",
      conditionFingerprint: buildFingerprint(type, [dayBucket(daysUntil, [minDaysUntil, minDaysUntil + 4])]),
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

// ---------------------------------------------------------------------------
// Contractor hours pending payment (weekly, due by Friday)
// ---------------------------------------------------------------------------
// NOT WIRED IN YET — depends on a `paid_at` column on subcontractor_time_entries
// that doesn't exist until the proposed migration is reviewed and applied.
// Written now so it's ready to connect as soon as that lands.

export interface PayableTimeEntry {
  id: string;
  subcontractorId: string;
  subcontractorName: string;
  workDate: string;
  hours: number;
  hourlyRate: number | null;
  paidAt: string | null;
}

/** The Friday that closes out a given work date's pay week — that day itself if it's already Friday, otherwise the next upcoming Friday. Computed per-entry rather than as one shared "current cycle," since that's genuinely ambiguous on a Saturday (just-closed Friday, or the new week that just started?) — per-entry due dates aren't. */
function nextFridayOnOrAfter(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const day = date.getUTCDay(); // 0=Sun..5=Fri..6=Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysUntilFriday));
  return friday.toISOString().slice(0, 10);
}

export function contractorHoursPendingSignal(entries: PayableTimeEntry[], asOf: Date): Signal | null {
  const relevant = entries.filter((e) => {
    if (e.paidAt !== null) return false;
    const dueFriday = nextFridayOnOrAfter(e.workDate);
    // Bounded to +/-7 days of its own due Friday so this stays a "this
    // week" reminder — an old unpaid backlog is a different, separate
    // problem, not something "due by Friday" framing should keep claiming.
    return Math.abs(daysBetween(dueFriday, asOf)) <= 7;
  });
  if (relevant.length === 0) return null;

  const total = relevant.reduce((s, e) => s + e.hours * (e.hourlyRate ?? 0), 0);
  const totalHours = relevant.reduce((s, e) => s + e.hours, 0);
  const earliestDue = relevant.map((e) => nextFridayOnOrAfter(e.workDate)).sort()[0];
  const overdue = daysBetween(earliestDue, asOf) > 0;

  return {
    type: "contractor_hours_pending",
    sourceTable: "subcontractor_time_entries",
    sourceId: syntheticSourceId(`contractor_hours_pending:${earliestDue}`),
    title: overdue ? "Contractor hours past due for payment" : "Contractor hours due by Friday",
    reason: `${totalHours.toLocaleString()} unpaid hours logged ($${Math.round(total).toLocaleString()}) ${overdue ? "were due" : "are due"} by ${earliestDue}.`,
    severity: overdue ? "high" : "medium",
    conditionFingerprint: buildFingerprint("contractor_hours_pending", [earliestDue, overdue ? "overdue" : "pending"]),
    metricValue: total,
    metricLabel: "unpaid_dollars",
    context: { dueFriday: earliestDue, totalHours, entryIds: relevant.map((e) => e.id) },
  };
}
