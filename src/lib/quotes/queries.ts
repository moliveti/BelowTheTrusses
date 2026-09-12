import { createClient } from "@/lib/supabase/server";
import type { Quote, SelectionCatalogItem } from "./types";

export async function getSelectionCatalog(): Promise<SelectionCatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("selection_catalog")
    .select("id, category, item_name, default_hours, sequence_order")
    .eq("active", true)
    .order("sequence_order");
  if (error) throw new Error(`selection_catalog: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    itemName: r.item_name,
    defaultHours: r.default_hours,
    sequenceOrder: r.sequence_order,
  }));
}

/** Most recent quote id per lead, so the Leads table can show a persistent Download PDF link on every row that already has one -- not just right after creating it in the current session. */
export async function getLatestQuoteIdsByLead(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, lead_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`quotes: ${error.message}`);

  const byLead: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!(row.lead_id in byLead)) byLead[row.lead_id] = row.id;
  }
  return byLead;
}

/** Most recent quote for a project (a project may only ever have one today, but "most recent" keeps this safe if a quote is ever regenerated). */
export async function getQuoteForProject(projectId: string): Promise<Quote | null> {
  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, lead_id, project_id, project_type, status, discount_type, discount_value, pm_hourly_rate, pm_estimated_hours, subtotal, total, pdf_storage_path, created_at"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`quotes: ${error.message}`);
  if (!quote) return null;

  const [lineItemsRes, selectionsRes] = await Promise.all([
    supabase
      .from("quote_line_items")
      .select("id, section, task_name, hours, rate, amount, sequence_order")
      .eq("quote_id", quote.id)
      .order("sequence_order"),
    supabase
      .from("quote_selections")
      .select("id, catalog_item_id, qty, hours, selection_catalog(category, item_name)")
      .eq("quote_id", quote.id),
  ]);
  if (lineItemsRes.error) throw new Error(`quote_line_items: ${lineItemsRes.error.message}`);
  if (selectionsRes.error) throw new Error(`quote_selections: ${selectionsRes.error.message}`);

  return {
    id: quote.id,
    leadId: quote.lead_id,
    projectId: quote.project_id,
    projectType: quote.project_type,
    status: quote.status,
    discountType: quote.discount_type,
    discountValue: quote.discount_value,
    pmHourlyRate: quote.pm_hourly_rate,
    pmEstimatedHours: quote.pm_estimated_hours,
    subtotal: quote.subtotal,
    total: quote.total,
    pdfStoragePath: quote.pdf_storage_path,
    createdAt: quote.created_at,
    lineItems: (lineItemsRes.data ?? []).map((li) => ({
      id: li.id,
      section: li.section,
      taskName: li.task_name,
      hours: li.hours,
      rate: li.rate,
      amount: li.amount,
      sequenceOrder: li.sequence_order,
    })),
    selections: (selectionsRes.data ?? []).map((s) => {
      const catalog = Array.isArray(s.selection_catalog) ? s.selection_catalog[0] : s.selection_catalog;
      return {
        id: s.id,
        catalogItemId: s.catalog_item_id,
        category: catalog?.category ?? "",
        itemName: catalog?.item_name ?? "",
        qty: s.qty,
        hours: s.hours,
      };
    }),
  };
}
