import { createClient } from "@/lib/supabase/server";
import type { ProjectDetail, ProjectListItem } from "./types";

export async function getProjectsIndex(): Promise<ProjectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, type, active, clients(name)")
    .order("name");
  if (error) throw new Error(`projects: ${error.message}`);

  return (data ?? []).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return {
      id: p.id,
      name: p.name,
      clientName: client?.name ?? "Unknown",
      type: p.type,
      active: p.active,
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
      .select("subcontractor_id, hours, subcontractors(name)")
      .eq("project_id", id),
    supabase
      .from("project_subcontractors")
      .select("subcontractor_id, hourly_rate, allocated_hours")
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

  const assignmentBySub = new Map(
    (assignmentsRes.data ?? []).map((a) => [a.subcontractor_id, { rate: a.hourly_rate, allocated: a.allocated_hours }])
  );

  const hoursBySub = new Map<string, { name: string; hours: number }>();
  for (const e of timeEntriesRes.data ?? []) {
    const sub = Array.isArray(e.subcontractors) ? e.subcontractors[0] : e.subcontractors;
    const name = sub?.name ?? "Unknown";
    if (!hoursBySub.has(e.subcontractor_id)) hoursBySub.set(e.subcontractor_id, { name, hours: 0 });
    hoursBySub.get(e.subcontractor_id)!.hours += e.hours;
  }

  let hasUnknownRate = false;
  let totalCost = 0;
  const hoursByPerson = Array.from(hoursBySub.entries()).map(([subcontractorId, v]) => {
    const assignment = assignmentBySub.get(subcontractorId);
    const rate = assignment?.rate ?? null;
    const cost = rate !== null ? v.hours * rate : null;
    if (cost === null) hasUnknownRate = true;
    else totalCost += cost;
    return {
      subcontractorId,
      subcontractorName: v.name,
      hours: v.hours,
      rate,
      allocatedHours: assignment?.allocated ?? null,
      cost,
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
