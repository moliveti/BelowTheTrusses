import { createClient } from "@/lib/supabase/server";
import type { DashboardData, ProjectType, RevenueRow } from "./types";

function toRevenueRow(dateStr: string, amount: number, type: string, referralSourceId: string | null): RevenueRow | null {
  if (!amount) return null;
  const d = new Date(dateStr);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    type: type as ProjectType,
    amount,
    referralSourceId,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [milestonesRes, committedProjectsRes, referralSourcesRes, sowRes] = await Promise.all([
    supabase
      .from("milestones")
      .select("paid_date, amount_paid, projects!inner(type, referral_source_id)")
      .not("paid_date", "is", null)
      .not("amount_paid", "is", null),
    supabase
      .from("projects")
      .select("contract_signed_date, contract_value, type, referral_source_id")
      .not("contract_signed_date", "is", null)
      .not("contract_value", "is", null),
    supabase.from("referral_sources").select("id, name, type"),
    supabase
      .from("sow_sent")
      .select("date_sent, prospect_name, proposed_fee, status, notes")
      .order("date_sent", { ascending: true, nullsFirst: false }),
  ]);

  if (milestonesRes.error) throw new Error(`milestones: ${milestonesRes.error.message}`);
  if (committedProjectsRes.error) throw new Error(`projects: ${committedProjectsRes.error.message}`);
  if (referralSourcesRes.error) throw new Error(`referral_sources: ${referralSourcesRes.error.message}`);
  if (sowRes.error) throw new Error(`sow_sent: ${sowRes.error.message}`);

  const collected: RevenueRow[] = [];
  for (const m of milestonesRes.data ?? []) {
    const project = Array.isArray(m.projects) ? m.projects[0] : m.projects;
    if (!project || !m.paid_date || m.amount_paid === null) continue;
    const row = toRevenueRow(m.paid_date, m.amount_paid, project.type, project.referral_source_id);
    if (row) collected.push(row);
  }

  const committed: RevenueRow[] = [];
  for (const p of committedProjectsRes.data ?? []) {
    if (!p.contract_signed_date || p.contract_value === null) continue;
    const row = toRevenueRow(p.contract_signed_date, p.contract_value, p.type, p.referral_source_id);
    if (row) committed.push(row);
  }

  return {
    collected,
    committed,
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
