import { createClient } from "@/lib/supabase/server";
import type { ProjectDetail, ProjectListItem } from "./types";

export async function getProjectsIndex(): Promise<ProjectListItem[]> {
  const supabase = await createClient();

  const [projectsRes, milestonesRes, timeEntriesRes] = await Promise.all([
    supabase.from("projects").select("id, name, type, active, contract_value, clients(name)").order("name"),
    supabase.from("milestones").select("project_id, amount_due, amount_paid"),
    supabase.from("subcontractor_time_entries").select("project_id, hours, hourly_rate"),
  ]);

  if (projectsRes.error) throw new Error(`projects: ${projectsRes.error.message}`);
  if (milestonesRes.error) throw new Error(`milestones: ${milestonesRes.error.message}`);
  if (timeEntriesRes.error) throw new Error(`subcontractor_time_entries: ${timeEntriesRes.error.message}`);

  const billingByProject = new Map<string, { amountDue: number; amountPaid: number }>();
  for (const m of milestonesRes.data ?? []) {
    if (!billingByProject.has(m.project_id)) billingByProject.set(m.project_id, { amountDue: 0, amountPaid: 0 });
    const entry = billingByProject.get(m.project_id)!;
    entry.amountDue += m.amount_due ?? 0;
    entry.amountPaid += m.amount_paid ?? 0;
  }

  // Cost uses each entry's own rate, frozen at log time (0009_rate_snapshot.sql)
  // — never the current default/assignment rate — so it's never retroactive.
  const hoursByProject = new Map<string, { hours: number; cost: number; hasUnknownRate: boolean }>();
  for (const e of timeEntriesRes.data ?? []) {
    if (!hoursByProject.has(e.project_id)) hoursByProject.set(e.project_id, { hours: 0, cost: 0, hasUnknownRate: false });
    const entry = hoursByProject.get(e.project_id)!;
    entry.hours += e.hours;
    if (e.hourly_rate === null) entry.hasUnknownRate = true;
    else entry.cost += e.hours * e.hourly_rate;
  }

  return (projectsRes.data ?? []).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    const billing = billingByProject.get(p.id) ?? { amountDue: 0, amountPaid: 0 };
    const hoursCost = hoursByProject.get(p.id) ?? { hours: 0, cost: 0, hasUnknownRate: false };
    return {
      id: p.id,
      name: p.name,
      clientName: client?.name ?? "Unknown",
      type: p.type,
      active: p.active,
      hours: hoursCost.hours,
      totalCost: hoursCost.cost,
      hasUnknownRate: hoursCost.hasUnknownRate,
      plannedRevenue: p.contract_value,
      amountPaid: billing.amountPaid,
      outstandingBalance: billing.amountDue - billing.amountPaid,
    };
  });
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();

  const [projectRes, scopeTagsRes, milestonesRes, timeEntriesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `id, name, type, state, active, notes, contract_signed_date, contract_value, billing_method,
         hourly_rate, fixed_fee_amount, addon_hours, addon_hourly_rate, furniture_commission_rate,
         furniture_sale_total, start_date, target_completion_date, actual_completion_date,
         clients(name), referral_sources(name)`
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("project_scope_tags").select("amount, scope_tags(name)").eq("project_id", id),
    supabase
      .from("milestones")
      .select("id, name, sequence_order, due_date, amount_due, paid_date, amount_paid, status")
      .eq("project_id", id)
      .order("sequence_order"),
    supabase
      .from("subcontractor_time_entries")
      .select("subcontractor_id, hours, hourly_rate, subcontractors(name)")
      .eq("project_id", id),
    supabase
      .from("project_subcontractors")
      .select("subcontractor_id, allocated_hours")
      .eq("project_id", id),
  ]);

  if (projectRes.error) throw new Error(`projects: ${projectRes.error.message}`);
  if (!projectRes.data) return null;
  if (scopeTagsRes.error) throw new Error(`project_scope_tags: ${scopeTagsRes.error.message}`);
  if (milestonesRes.error) throw new Error(`milestones: ${milestonesRes.error.message}`);
  if (timeEntriesRes.error) throw new Error(`subcontractor_time_entries: ${timeEntriesRes.error.message}`);
  if (assignmentsRes.error) throw new Error(`project_subcontractors: ${assignmentsRes.error.message}`);

  const p = projectRes.data;
  const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
  const referral = Array.isArray(p.referral_sources) ? p.referral_sources[0] : p.referral_sources;

  const allocatedBySub = new Map((assignmentsRes.data ?? []).map((a) => [a.subcontractor_id, a.allocated_hours]));

  // Cost uses each entry's own rate, frozen at log time (0009_rate_snapshot.sql),
  // not a live lookup of the current assignment/default rate — so a rate
  // change never retroactively re-costs hours already logged. If a person's
  // rate changed mid-project, `rate` below reflects that by showing null
  // (varies) rather than picking one arbitrarily.
  const hoursBySub = new Map<string, { name: string; hours: number; cost: number; hasUnknownRate: boolean; rates: Set<number> }>();
  for (const e of timeEntriesRes.data ?? []) {
    const sub = Array.isArray(e.subcontractors) ? e.subcontractors[0] : e.subcontractors;
    const name = sub?.name ?? "Unknown";
    if (!hoursBySub.has(e.subcontractor_id)) {
      hoursBySub.set(e.subcontractor_id, { name, hours: 0, cost: 0, hasUnknownRate: false, rates: new Set() });
    }
    const entry = hoursBySub.get(e.subcontractor_id)!;
    entry.hours += e.hours;
    if (e.hourly_rate === null) entry.hasUnknownRate = true;
    else {
      entry.cost += e.hours * e.hourly_rate;
      entry.rates.add(e.hourly_rate);
    }
  }

  let hasUnknownRate = false;
  let totalCost = 0;
  const hoursByPerson = Array.from(hoursBySub.entries()).map(([subcontractorId, v]) => {
    if (v.hasUnknownRate) hasUnknownRate = true;
    totalCost += v.cost;
    return {
      subcontractorId,
      subcontractorName: v.name,
      hours: v.hours,
      rate: v.rates.size === 1 ? v.rates.values().next().value ?? null : null,
      allocatedHours: allocatedBySub.get(subcontractorId) ?? null,
      cost: v.hasUnknownRate && v.rates.size === 0 ? null : v.cost,
    };
  });
  hoursByPerson.sort((a, b) => b.hours - a.hours);

  const milestones = (milestonesRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    sequenceOrder: m.sequence_order,
    dueDate: m.due_date,
    amountDue: m.amount_due,
    paidDate: m.paid_date,
    amountPaid: m.amount_paid,
    status: m.status,
  }));

  const totalCollected = milestones.reduce((s, m) => s + (m.amountPaid ?? 0), 0);

  const scopeTags = (scopeTagsRes.data ?? []).map((s) => {
    const tag = Array.isArray(s.scope_tags) ? s.scope_tags[0] : s.scope_tags;
    return { name: tag?.name ?? "Unknown", amount: s.amount };
  });

  return {
    id: p.id,
    name: p.name,
    clientName: client?.name ?? "Unknown",
    type: p.type,
    state: p.state,
    active: p.active,
    notes: p.notes,
    referralSourceName: referral?.name ?? null,
    contractSignedDate: p.contract_signed_date,
    contractValue: p.contract_value,
    billingMethod: p.billing_method,
    hourlyRate: p.hourly_rate,
    fixedFeeAmount: p.fixed_fee_amount,
    addonHours: p.addon_hours,
    addonHourlyRate: p.addon_hourly_rate,
    furnitureCommissionRate: p.furniture_commission_rate,
    furnitureSaleTotal: p.furniture_sale_total,
    startDate: p.start_date,
    targetCompletionDate: p.target_completion_date,
    actualCompletionDate: p.actual_completion_date,
    scopeTags,
    milestones,
    hoursByPerson,
    totalCollected,
    totalCost,
    hasUnknownRate,
  };
}
