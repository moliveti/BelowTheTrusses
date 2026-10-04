import type { createClient } from "@/lib/supabase/client";
import { toIsoDate } from "@/lib/hours/dates";

type Db = ReturnType<typeof createClient>;
type Result<T> = ({ ok: true } & T) | { error: string };

/** A contract has gone out: the quote is approved and its lead moves to Contract Submitted. */
export async function markContractSent(db: Db, projectId: string): Promise<Result<object>> {
  const quotes = await db.from("quotes").update({ status: "accepted" }).eq("project_id", projectId).in("status", ["draft", "sent"]);
  if (quotes.error) return { error: quotes.error.message };

  const leads = await db
    .from("leads")
    .update({ status: "Contract Submitted" })
    .eq("converted_project_id", projectId)
    .in("status", ["New Prospect", "Quote Sent"]);
  if (leads.error) return { error: leads.error.message };

  return { ok: true };
}

/**
 * The contract is signed: the quote-stage project becomes a real project
 * (Under Contract) and every piece that tracked it through the pipeline is
 * closed out in the same step -- the contract, the quote, the lead (which
 * then drops out of Quotes & Leads) and its open proposal row.
 */
export async function markProjectSigned(db: Db, projectId: string): Promise<Result<{ leadsConverted: number }>> {
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id, contract_signed_date")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) return { error: projectError.message };
  if (!project) return { error: "Project not found." };

  const projectUpdate = await db
    .from("projects")
    .update({ status: "Under Contract", contract_signed_date: project.contract_signed_date ?? toIsoDate(new Date()) })
    .eq("id", projectId);
  if (projectUpdate.error) return { error: projectUpdate.error.message };

  const contracts = await db
    .from("contracts")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("signed_at", null);
  if (contracts.error) return { error: contracts.error.message };

  const quotes = await db.from("quotes").update({ status: "accepted" }).eq("project_id", projectId).in("status", ["draft", "sent"]);
  if (quotes.error) return { error: quotes.error.message };

  const { data: leads, error: leadsError } = await db
    .from("leads")
    .select("id, converted_sow_id")
    .eq("converted_project_id", projectId)
    .neq("status", "Signed Contract");
  if (leadsError) return { error: leadsError.message };

  for (const lead of leads ?? []) {
    const leadUpdate = await db.from("leads").update({ status: "Signed Contract" }).eq("id", lead.id);
    if (leadUpdate.error) return { error: leadUpdate.error.message };
    if (lead.converted_sow_id) {
      const sow = await db
        .from("sow_sent")
        .update({ status: "Converted", converted_project_id: projectId })
        .eq("id", lead.converted_sow_id);
      if (sow.error) return { error: sow.error.message };
    }
  }

  return { ok: true, leadsConverted: leads?.length ?? 0 };
}
