import type { createClient } from "@/lib/supabase/client";
import { EDITABLE_QUOTE_STATUSES, type StoredLineItem } from "./edit";

type Db = ReturnType<typeof createClient>;

export interface ExistingQuote {
  quoteId: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  projectType: "Residential" | "Commercial" | "Furniture";
  lineItems: StoredLineItem[];
  selectionQty: Record<string, string>;
  includePm: boolean;
  pmHourlyRate: string;
  pmEstimatedHours: string;
  discountType: "" | "percent" | "fixed";
  discountValue: string;
}

/** Reads a saved quote back into the shape the quote builder works with, or says why it can't be edited. */
export async function loadQuoteForEdit(db: Db, quoteId: string): Promise<ExistingQuote | { error: string }> {
  const { data: quote, error: quoteError } = await db
    .from("quotes")
    .select("id, project_id, project_type, status, discount_type, discount_value, pm_hourly_rate, pm_estimated_hours")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError) return { error: quoteError.message };
  if (!quote) return { error: "Quote not found." };
  if (!EDITABLE_QUOTE_STATUSES.includes(quote.status)) {
    return { error: "This quote was accepted when its contract was generated, so it can't be edited any more." };
  }

  const [project, lineItems, selections] = await Promise.all([
    db.from("projects").select("name, client_id, clients(name)").eq("id", quote.project_id).maybeSingle(),
    db.from("quote_line_items").select("section, task_name, hours, rate").eq("quote_id", quoteId).order("sequence_order"),
    db.from("quote_selections").select("catalog_item_id, qty").eq("quote_id", quoteId),
  ]);
  const failure = [project, lineItems, selections].find((r) => r.error)?.error;
  if (failure) return { error: failure.message };
  if (!project.data) return { error: "This quote's project no longer exists." };

  const client = Array.isArray(project.data.clients) ? project.data.clients[0] : project.data.clients;

  return {
    quoteId,
    projectId: quote.project_id,
    projectName: project.data.name,
    clientId: project.data.client_id,
    clientName: client?.name ?? "Client",
    projectType: quote.project_type,
    lineItems: (lineItems.data ?? []).map((li) => ({
      section: li.section,
      taskName: li.task_name,
      hours: li.hours,
      rate: li.rate,
    })),
    selectionQty: Object.fromEntries((selections.data ?? []).map((s) => [s.catalog_item_id, String(s.qty)])),
    includePm: quote.pm_hourly_rate !== null,
    pmHourlyRate: quote.pm_hourly_rate !== null ? String(quote.pm_hourly_rate) : "200",
    pmEstimatedHours: quote.pm_estimated_hours !== null ? String(quote.pm_estimated_hours) : "",
    discountType: quote.discount_type ?? "",
    discountValue: quote.discount_value !== null && quote.discount_type ? String(quote.discount_value) : "",
  };
}
