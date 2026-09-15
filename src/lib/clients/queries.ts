import { createClient } from "@/lib/supabase/server";
import { getProjectsForClient } from "@/lib/projects/queries";
import type { ClientDetail, ClientListItem, ClientOption } from "./types";

export async function getClientsIndex(): Promise<ClientListItem[]> {
  const supabase = await createClient();

  const [clientsRes, projectsRes, milestonesRes] = await Promise.all([
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("projects").select("id, client_id, type, active, contract_value"),
    supabase.from("milestones").select("project_id, amount_due, amount_paid"),
  ]);
  if (clientsRes.error) throw new Error(`clients: ${clientsRes.error.message}`);
  if (projectsRes.error) throw new Error(`projects: ${projectsRes.error.message}`);
  if (milestonesRes.error) throw new Error(`milestones: ${milestonesRes.error.message}`);

  const billingByProject = new Map<string, { amountDue: number; amountPaid: number }>();
  for (const m of milestonesRes.data ?? []) {
    if (!billingByProject.has(m.project_id)) billingByProject.set(m.project_id, { amountDue: 0, amountPaid: 0 });
    const entry = billingByProject.get(m.project_id)!;
    entry.amountDue += m.amount_due ?? 0;
    entry.amountPaid += m.amount_paid ?? 0;
  }

  interface ClientAgg {
    projectCount: number;
    activeProjectCount: number;
    types: Set<string>;
    totalPlannedRevenue: number;
    totalPaid: number;
    totalOutstanding: number;
  }
  const byClient = new Map<string, ClientAgg>();
  for (const p of projectsRes.data ?? []) {
    if (!p.client_id) continue;
    if (!byClient.has(p.client_id)) {
      byClient.set(p.client_id, {
        projectCount: 0,
        activeProjectCount: 0,
        types: new Set(),
        totalPlannedRevenue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
      });
    }
    const agg = byClient.get(p.client_id)!;
    agg.projectCount += 1;
    if (p.active) agg.activeProjectCount += 1;
    agg.types.add(p.type);
    agg.totalPlannedRevenue += p.contract_value ?? 0;
    const billing = billingByProject.get(p.id) ?? { amountDue: 0, amountPaid: 0 };
    agg.totalPaid += billing.amountPaid;
    agg.totalOutstanding += billing.amountDue - billing.amountPaid;
  }

  return (clientsRes.data ?? []).map((c) => {
    const agg = byClient.get(c.id);
    return {
      id: c.id,
      name: c.name,
      projectCount: agg?.projectCount ?? 0,
      activeProjectCount: agg?.activeProjectCount ?? 0,
      types: agg ? Array.from(agg.types) : [],
      totalPlannedRevenue: agg?.totalPlannedRevenue ?? 0,
      totalPaid: agg?.totalPaid ?? 0,
      totalOutstanding: agg?.totalOutstanding ?? 0,
    };
  });
}

export async function getAllClientOptions(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  if (error) throw new Error(`clients: ${error.message}`);
  return data ?? [];
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const supabase = await createClient();
  const { data: client, error } = await supabase.from("clients").select("id, name").eq("id", id).maybeSingle();
  if (error) throw new Error(`clients: ${error.message}`);
  if (!client) return null;

  const projects = await getProjectsForClient(id);
  return { id: client.id, name: client.name, projects };
}
