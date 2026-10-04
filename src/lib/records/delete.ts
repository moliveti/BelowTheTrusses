import type { createClient } from "@/lib/supabase/client";

type Db = ReturnType<typeof createClient>;

/** What hangs off a project, used both to explain a delete and to decide whether it's allowed. */
export interface ProjectImpact {
  id: string;
  name: string;
  status: string | null;
  timeEntryCount: number;
  paymentCount: number;
  milestoneCount: number;
  allocationCount: number;
  quoteIds: string[];
  contracts: { id: string; signed: boolean }[];
}

export interface DeleteSummary {
  quotesDeleted: number;
  projectsDeleted: string[];
  projectsKept: { name: string; reasons: string[] }[];
  sowDeleted: boolean;
  leadReset: boolean;
}

export interface LeadDeletionPreview {
  quoteCount: number;
  willDeleteProjects: string[];
  willKeepProjects: { name: string; reasons: string[] }[];
  hasProposal: boolean;
}

type Failure = { error: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const QUOTE_STAGE_LEAD_STATUSES = ["Quote Sent", "Contract Submitted"];

export async function loadProjectImpact(db: Db, projectId: string): Promise<ProjectImpact | Failure> {
  const [project, timeEntries, milestones, allocations, quotes, contracts] = await Promise.all([
    db.from("projects").select("id, name, status").eq("id", projectId).maybeSingle(),
    db.from("subcontractor_time_entries").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    db.from("milestones").select("id, amount_paid").eq("project_id", projectId),
    db.from("project_subcontractors").select("project_id", { count: "exact", head: true }).eq("project_id", projectId),
    db.from("quotes").select("id").eq("project_id", projectId),
    db.from("contracts").select("id, signed_at").eq("project_id", projectId),
  ]);

  const firstError = [project, timeEntries, milestones, allocations, quotes, contracts].find((r) => r.error)?.error;
  if (firstError) return { error: firstError.message };
  if (!project.data) return { error: "Project not found." };

  const milestoneRows = milestones.data ?? [];
  return {
    id: project.data.id,
    name: project.data.name,
    status: project.data.status,
    timeEntryCount: timeEntries.count ?? 0,
    paymentCount: milestoneRows.filter((m) => (m.amount_paid ?? 0) > 0).length,
    milestoneCount: milestoneRows.length,
    allocationCount: allocations.count ?? 0,
    quoteIds: (quotes.data ?? []).map((q) => q.id),
    contracts: (contracts.data ?? []).map((c) => ({ id: c.id, signed: c.signed_at !== null })),
  };
}

/** Records that make a project too real to delete: logged hours, money received, or a signed contract. */
export function projectBlockers(impact: ProjectImpact): string[] {
  const reasons: string[] = [];
  if (impact.timeEntryCount > 0) reasons.push(`${plural(impact.timeEntryCount, "contractor time entry", "contractor time entries")} logged`);
  if (impact.paymentCount > 0) reasons.push(`${plural(impact.paymentCount, "payment", "payments")} recorded`);
  const signed = impact.contracts.filter((c) => c.signed).length;
  if (signed > 0) reasons.push(`${plural(signed, "signed contract", "signed contracts")}`);
  return reasons;
}

/** A project that exists only because a quote was built: still "Quoted", nothing attached. */
export function isQuotePlaceholder(impact: ProjectImpact): boolean {
  return impact.status === "Quoted" && impact.contracts.length === 0 && projectBlockers(impact).length === 0;
}

function keepReasons(impact: ProjectImpact): string[] {
  const reasons: string[] = [];
  if (impact.contracts.length > 0) reasons.push(impact.contracts.length === 1 ? "has a contract" : "has contracts");
  if (impact.timeEntryCount > 0) reasons.push("has contractor hours");
  if (impact.paymentCount > 0) reasons.push("has recorded payments");
  if (reasons.length === 0 && impact.status && impact.status !== "Quoted") reasons.push(`status is ${impact.status}`);
  return reasons;
}

async function remove(db: Db, table: string, column: string, value: string): Promise<{ count: number } | Failure> {
  const { data, error } = await db.from(table).delete().eq(column, value).select("id");
  if (error) return { error: error.message };
  return { count: data?.length ?? 0 };
}

async function removeProposal(db: Db, sowId: string): Promise<boolean> {
  const { data } = await db.from("sow_sent").delete().eq("id", sowId).is("converted_project_id", null).select("id");
  return (data?.length ?? 0) > 0;
}

/** Deletes a project plus its quotes and (unsigned) contracts. Milestones, allocations and scope tags cascade in the database. */
export async function deleteProjectCascade(db: Db, projectId: string): Promise<{ ok: true } | Failure> {
  const impact = await loadProjectImpact(db, projectId);
  if ("error" in impact) return impact;
  const blockers = projectBlockers(impact);
  if (blockers.length > 0) return { error: `Can't delete this project — ${blockers.join(", ")}.` };

  const { data: linkedLeads, error: leadsError } = await db
    .from("leads")
    .select("id, status, converted_sow_id")
    .eq("converted_project_id", projectId);
  if (leadsError) return { error: leadsError.message };

  const quotes = await remove(db, "quotes", "project_id", projectId);
  if ("error" in quotes) return quotes;
  const contracts = await remove(db, "contracts", "project_id", projectId);
  if ("error" in contracts) return contracts;
  const project = await remove(db, "projects", "id", projectId);
  if ("error" in project) return project;
  if (project.count === 0) return { error: "The project wasn't deleted — it may already be gone, or you may not have permission." };

  // A lead sitting at the quote stage goes back to being a prospect once its quote is gone.
  for (const lead of linkedLeads ?? []) {
    if (!QUOTE_STAGE_LEAD_STATUSES.includes(lead.status)) continue;
    await db.from("leads").update({ status: "New Prospect", converted_sow_id: null }).eq("id", lead.id);
    if (lead.converted_sow_id) await removeProposal(db, lead.converted_sow_id);
  }
  return { ok: true };
}

export async function previewLeadDeletion(db: Db, leadId: string, convertedProjectId: string | null): Promise<LeadDeletionPreview | Failure> {
  const [quotes, lead] = await Promise.all([
    db.from("quotes").select("id, project_id").eq("lead_id", leadId),
    db.from("leads").select("converted_sow_id").eq("id", leadId).maybeSingle(),
  ]);
  if (quotes.error) return { error: quotes.error.message };
  if (lead.error) return { error: lead.error.message };

  const quoteRows = quotes.data ?? [];
  const projectIds = Array.from(new Set(quoteRows.map((q) => q.project_id)));
  const willDeleteProjects: string[] = [];
  const willKeepProjects: { name: string; reasons: string[] }[] = [];

  for (const projectId of projectIds) {
    const impact = await loadProjectImpact(db, projectId);
    if ("error" in impact) return impact;
    if (isQuotePlaceholder(impact)) willDeleteProjects.push(impact.name);
    else willKeepProjects.push({ name: impact.name, reasons: keepReasons(impact) });
  }

  if (convertedProjectId && !projectIds.includes(convertedProjectId)) {
    const impact = await loadProjectImpact(db, convertedProjectId);
    if (!("error" in impact)) willKeepProjects.push({ name: impact.name, reasons: ["it wasn't created from a quote"] });
  }

  return {
    quoteCount: quoteRows.length,
    willDeleteProjects,
    willKeepProjects,
    hasProposal: Boolean(lead.data?.converted_sow_id),
  };
}

async function deleteQuotesForLead(
  db: Db,
  leadId: string
): Promise<{ quotesDeleted: number; projectsDeleted: string[]; projectsKept: { name: string; reasons: string[] }[] } | Failure> {
  const { data: quotes, error } = await db.from("quotes").select("id, project_id").eq("lead_id", leadId);
  if (error) return { error: error.message };

  const projectIds = Array.from(new Set((quotes ?? []).map((q) => q.project_id)));
  const projectsDeleted: string[] = [];
  const projectsKept: { name: string; reasons: string[] }[] = [];
  let quotesDeleted = 0;

  for (const projectId of projectIds) {
    const impact = await loadProjectImpact(db, projectId);
    if ("error" in impact) return impact;

    if (isQuotePlaceholder(impact)) {
      const result = await deleteProjectCascade(db, projectId);
      if ("error" in result) return result;
      quotesDeleted += impact.quoteIds.length;
      projectsDeleted.push(impact.name);
    } else {
      const removed = await db.from("quotes").delete().eq("lead_id", leadId).eq("project_id", projectId).select("id");
      if (removed.error) return { error: removed.error.message };
      quotesDeleted += removed.data?.length ?? 0;
      projectsKept.push({ name: impact.name, reasons: keepReasons(impact) });
    }
  }

  return { quotesDeleted, projectsDeleted, projectsKept };
}

/** Removes a lead along with its quotes, its open proposal row, and any quote-stage placeholder project. */
export async function deleteLead(db: Db, leadId: string): Promise<DeleteSummary | Failure> {
  const { data: lead, error: leadError } = await db.from("leads").select("id, converted_sow_id").eq("id", leadId).maybeSingle();
  if (leadError) return { error: leadError.message };
  if (!lead) return { error: "Lead not found — it may already have been deleted." };

  const quotes = await deleteQuotesForLead(db, leadId);
  if ("error" in quotes) return quotes;

  const removed = await remove(db, "leads", "id", leadId);
  if ("error" in removed) return removed;
  if (removed.count === 0) return { error: "The lead wasn't deleted — you may not have permission." };

  const sowDeleted = lead.converted_sow_id ? await removeProposal(db, lead.converted_sow_id) : false;
  return { ...quotes, sowDeleted, leadReset: false };
}

/** Removes just the quote(s) on a lead; the lead goes back to New Prospect when nothing else is left holding it at the quote stage. */
export async function deleteQuoteOnly(db: Db, leadId: string): Promise<DeleteSummary | Failure> {
  const { data: lead, error: leadError } = await db
    .from("leads")
    .select("id, status, converted_sow_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) return { error: leadError.message };
  if (!lead) return { error: "Lead not found." };

  const quotes = await deleteQuotesForLead(db, leadId);
  if ("error" in quotes) return quotes;

  const atQuoteStage = QUOTE_STAGE_LEAD_STATUSES.includes(lead.status);
  const nothingKept = quotes.projectsKept.length === 0;
  let sowDeleted = false;
  let leadReset = false;

  if (atQuoteStage && nothingKept) {
    const { error: resetError } = await db
      .from("leads")
      .update({ status: "New Prospect", converted_project_id: null, converted_sow_id: null })
      .eq("id", leadId);
    if (resetError) return { error: resetError.message };
    leadReset = true;
    sowDeleted = lead.converted_sow_id ? await removeProposal(db, lead.converted_sow_id) : false;
  }

  return { ...quotes, sowDeleted, leadReset };
}

export function describeDeletion(subject: string, summary: DeleteSummary): string {
  const parts: string[] = [];
  if (summary.quotesDeleted > 0) parts.push(`removed ${plural(summary.quotesDeleted, "quote", "quotes")}`);
  if (summary.projectsDeleted.length > 0) {
    parts.push(`removed the quote-stage project ${summary.projectsDeleted.map((n) => `"${n}"`).join(", ")}`);
  }
  if (summary.sowDeleted) parts.push("removed its open proposal");
  if (summary.leadReset) parts.push("lead is back to New Prospect");
  const base = `${subject}${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}.`;
  const kept = summary.projectsKept.map(
    (p) => `Project "${p.name}" was kept${p.reasons.length > 0 ? ` (${p.reasons.join(", ")})` : ""}.`
  );
  return [base, ...kept].join(" ");
}
