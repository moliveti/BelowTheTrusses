import { createClient } from "@/lib/supabase/server";
import type { DashboardData, ProjectType, RevenueRow } from "./types";

function toRevenueRow(
  dateStr: string,
  amount: number,
  type: string,
  referralSourceId: string | null,
  projectId: string,
  projectName: string
): RevenueRow | null {
  if (!amount) return null;
  const d = new Date(dateStr);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    type: type as ProjectType,
    amount,
    referralSourceId,
    projectId,
    projectName,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [paidMilestonesRes, dueMilestonesRes, referralSourcesRes, sowRes] = await Promise.all([
    supabase
      .from("milestones")
      .select("paid_date, amount_paid, projects!inner(id, name, type, referral_source_id)")
      .not("paid_date", "is", null)
      .not("amount_paid", "is", null),
    supabase
      .from("milestones")
      .select("due_date, amount_due, amount_paid, projects!inner(id, name, type, referral_source_id)")
      .not("due_date", "is", null)
      .not("amount_due", "is", null),
    supabase.from("referral_sources").select("id, name, type"),
    supabase
      .from("sow_sent")
      .select("date_sent, prospect_name, proposed_fee, status, notes")
      .order("date_sent", { ascending: true, nullsFirst: false }),
  ]);

  if (paidMilestonesRes.error) throw new Error(`milestones (paid): ${paidMilestonesRes.error.message}`);
  if (dueMilestonesRes.error) throw new Error(`milestones (due): ${dueMilestonesRes.error.message}`);
  if (referralSourcesRes.error) throw new Error(`referral_sources: ${referralSourcesRes.error.message}`);
  if (sowRes.error) throw new Error(`sow_sent: ${sowRes.error.message}`);

  const collected: RevenueRow[] = [];
  for (const m of paidMilestonesRes.data ?? []) {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    if (!project || !m.paid_date || m.amount_paid === null) continue;
    const row = toRevenueRow(m.paid_date, m.amount_paid, project.type, project.referral_source_id, project.id, project.name);
    if (row) collected.push(row);
  }

  // Contracted but not yet paid — the gap between what's due and what's
  // actually been collected on that milestone, bucketed by when it's due.
  const forecast: RevenueRow[] = [];
  for (const m of dueMilestonesRes.data ?? []) {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    if (!project || !m.due_date || m.amount_due === null) continue;
    const outstanding = m.amount_due - (m.amount_paid ?? 0);
    if (outstanding <= 0) continue;
    const row = toRevenueRow(m.due_date, outstanding, project.type, project.referral_source_id, project.id, project.name);
    if (row) forecast.push(row);
  }

  return {
    collected,
    forecast,
    referralSources: referralSourcesRes.data ?? [],
    sow: (sowRes.data ?? []).map((s) => ({
      dateSent: s.date_sent,
      prospectName: s.prospect_name,
      proposedFee: s.proposed_fee,
      status: s.status,
      notes: s.notes,
    })),
  };
}
