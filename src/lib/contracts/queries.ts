import { createClient } from "@/lib/supabase/server";
import type { ContractSummary } from "./types";

/** Most recent contract for a project, for a re-download link on page reload -- getQuoteForProject's counterpart. */
export async function getContractForProject(projectId: string): Promise<ContractSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`contracts: ${error.message}`);
  return data;
}
