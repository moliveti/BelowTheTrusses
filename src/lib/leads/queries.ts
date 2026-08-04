import { createClient } from "@/lib/supabase/server";
import type { Lead } from "./types";

export async function getLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, name, email, phone, project_type, state, budget_range, timeline, referral_source_id, referral_sources(name), notes, status, last_contacted_date, created_at, converted_sow_id, converted_project_id"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`leads: ${error.message}`);

  return (data ?? []).map((l) => {
    const referral = Array.isArray(l.referral_sources) ? l.referral_sources[0] : l.referral_sources;
    return {
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      projectType: l.project_type,
      state: l.state,
      budgetRange: l.budget_range,
      timeline: l.timeline,
      referralSourceId: l.referral_source_id,
      referralSourceName: referral?.name ?? null,
      notes: l.notes,
      status: l.status,
      lastContactedDate: l.last_contacted_date,
      createdAt: l.created_at,
      convertedSowId: l.converted_sow_id,
      convertedProjectId: l.converted_project_id,
    };
  });
}
