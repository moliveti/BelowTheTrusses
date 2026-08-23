"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/leads/types";
import type { SelectionCatalogItem } from "@/lib/quotes/types";
import { QUOTE_TASK_CATALOG } from "@/lib/scope";
import { toIsoDate } from "@/lib/hours/dates";

const TYPES = ["Residential", "Commercial", "Furniture"] as const;
const FINISH_SELECTIONS_TASK = "Finish Selections";

interface DraftLineItem {
  section: string;
  taskName: string;
  hours: string;
  rate: string;
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function QuoteBuilderPanel({
  lead,
  selectionCatalog,
  onClose,
  onCreated,
}: {
  lead: Lead;
  selectionCatalog: SelectionCatalogItem[];
  onClose: () => void;
  onCreated: (result: { projectId: string; quoteId: string }) => void;
}) {
  const [projectType, setProjectType] = useState<(typeof TYPES)[number]>(
    (lead.projectType as (typeof TYPES)[number]) || "Residential"
  );
  const [lineItems, setLineItems] = useState<DraftLineItem[]>(
    QUOTE_TASK_CATALOG.filter((t) => t.taskName !== FINISH_SELECTIONS_TASK).map((t) => ({
      section: t.section,
      taskName: t.taskName,
      hours: "",
      rate: String(t.rate),
    }))
  );
  const [selectionQty, setSelectionQty] = useState<Record<string, string>>({});
  const [includePm, setIncludePm] = useState(false);
  const [pmHourlyRate, setPmHourlyRate] = useState("200");
  const [pmEstimatedHours, setPmEstimatedHours] = useState("");
  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">("");
  const [discountValue, setDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finishSelectionsRate = QUOTE_TASK_CATALOG.find((t) => t.taskName === FINISH_SELECTIONS_TASK)!.rate;

  const finishSelectionsHours = useMemo(() => {
    return selectionCatalog.reduce((sum, item) => {
      const qty = Number(selectionQty[item.id] || 0);
      return sum + qty * item.defaultHours;
    }, 0);
  }, [selectionCatalog, selectionQty]);

  const lineItemsTotal = useMemo(() => {
    const manual = lineItems.reduce((s, li) => s + Number(li.hours || 0) * Number(li.rate || 0), 0);
    return manual + finishSelectionsHours * finishSelectionsRate;
  }, [lineItems, finishSelectionsHours, finishSelectionsRate]);

  const discountAmount = useMemo(() => {
    if (!discountType || !discountValue) return 0;
    const v = Number(discountValue);
    return discountType === "percent" ? (lineItemsTotal * v) / 100 : v;
  }, [discountType, discountValue, lineItemsTotal]);

  const subtotal = lineItemsTotal;
  const designFeeAfterDiscount = Math.max(0, subtotal - discountAmount);
  const pmFeeEstimate = includePm ? Number(pmHourlyRate || 0) * Number(pmEstimatedHours || 0) : 0;
  const total = designFeeAfterDiscount + pmFeeEstimate;

  function updateLineItem(index: number, patch: Partial<DraftLineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }

  const categories = Array.from(new Set(selectionCatalog.map((c) => c.category)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const supabase = createClient();

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert({ name: lead.name.trim() }, { onConflict: "name" })
      .select("id")
      .single();
    if (clientError) {
      setSaving(false);
      setError(clientError.message);
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: client.id,
        name: lead.name,
        type: projectType,
        state: lead.state,
        referral_source_id: lead.referralSourceId,
        billing_method: "Fixed Fee",
        active: true,
        status: "Quoted",
      })
      .select("id")
      .single();
    if (projectError) {
      setSaving(false);
      setError(projectError.message);
      return;
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        lead_id: lead.id,
        project_id: project.id,
        project_type: projectType,
        status: "draft",
        discount_type: discountType || null,
        discount_value: discountType ? Number(discountValue || 0) : null,
        pm_hourly_rate: includePm ? Number(pmHourlyRate || 0) : null,
        pm_estimated_hours: includePm ? Number(pmEstimatedHours || 0) : null,
        subtotal,
        total,
      })
      .select("id")
      .single();
    if (quoteError) {
      setSaving(false);
      setError(quoteError.message);
      return;
    }

    const rows = lineItems
      .filter((li) => Number(li.hours || 0) > 0)
      .map((li, i) => ({
        quote_id: quote.id,
        section: li.section,
        task_name: li.taskName,
        hours: Number(li.hours),
        rate: Number(li.rate),
        amount: Number(li.hours) * Number(li.rate),
        sequence_order: i + 1,
      }));
    if (finishSelectionsHours > 0) {
      rows.push({
        quote_id: quote.id,
        section: "FFE",
        task_name: FINISH_SELECTIONS_TASK,
        hours: finishSelectionsHours,
        rate: finishSelectionsRate,
        amount: finishSelectionsHours * finishSelectionsRate,
        sequence_order: rows.length + 1,
      });
    }
    if (rows.length > 0) {
      const { error: lineItemsError } = await supabase.from("quote_line_items").insert(rows);
      if (lineItemsError) {
        setSaving(false);
        setError(lineItemsError.message);
        return;
      }
    }

    const selectionRows = selectionCatalog
      .filter((item) => Number(selectionQty[item.id] || 0) > 0)
      .map((item) => ({
        quote_id: quote.id,
        catalog_item_id: item.id,
        qty: Number(selectionQty[item.id]),
        hours: Number(selectionQty[item.id]) * item.defaultHours,
      }));
    if (selectionRows.length > 0) {
      const { error: selectionsError } = await supabase.from("quote_selections").insert(selectionRows);
      if (selectionsError) {
        setSaving(false);
        setError(selectionsError.message);
        return;
      }
    }

    let convertedSowId = lead.convertedSowId;
    if (!convertedSowId) {
      const { data: sow } = await supabase
        .from("sow_sent")
        .insert({ date_sent: toIsoDate(new Date()), prospect_name: lead.name, notes: lead.notes, status: "Open" })
        .select("id")
        .single();
      convertedSowId = sow?.id ?? null;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update({ status: "Quote Sent", converted_project_id: project.id, converted_sow_id: convertedSowId })
      .eq("id", lead.id);
    if (leadError) {
      setSaving(false);
      setError(leadError.message);
      return;
    }

    setSaving(false);
    onCreated({ projectId: project.id, quoteId: quote.id });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h3 className="text-base text-ink">Build Quote — {lead.name}</h3>
          <button onClick={onClose} className="font-mono text-xs uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Project Type</label>
            <div className="flex gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setProjectType(t)}
                  className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
                    projectType === t ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-ink/60">
              Scope Tasks — enter hours for whatever applies to this project
            </label>
            <div className="border border-line bg-canvas">
              {lineItems.map((li, i) => (
                <div key={`${li.section}-${li.taskName}`} className="flex items-center gap-2 border-b border-line p-2 text-xs last:border-b-0">
                  <span className="w-40 flex-shrink-0 font-mono text-[9.5px] uppercase text-ink/40">{li.section}</span>
                  <span className="min-w-0 flex-1">{li.taskName}</span>
                  <input
                    type="number"
                    value={li.hours}
                    onChange={(e) => updateLineItem(i, { hours: e.target.value })}
                    placeholder="Hrs"
                    className="w-16 border border-line px-2 py-1 text-right text-xs"
                  />
                  <input
                    type="number"
                    value={li.rate}
                    onChange={(e) => updateLineItem(i, { rate: e.target.value })}
                    className="w-16 border border-line px-2 py-1 text-right text-xs"
                  />
                  <span className="w-20 flex-shrink-0 text-right font-mono tabular-nums">
                    {fmtUsd(Number(li.hours || 0) * Number(li.rate || 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-ink/60">
              Finish Selections — quantity per item, rolls up into one FFE line at {fmtUsd(finishSelectionsRate)}/hr
              (currently {finishSelectionsHours} hrs = {fmtUsd(finishSelectionsHours * finishSelectionsRate)})
            </label>
            <div className="max-h-64 overflow-y-auto border border-line bg-canvas">
              {categories.map((cat) => (
                <div key={cat} className="border-b border-line p-2 last:border-b-0">
                  <p className="mb-1 font-mono text-[9.5px] uppercase text-ink/40">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectionCatalog
                      .filter((item) => item.category === cat)
                      .map((item) => (
                        <label key={item.id} className="flex items-center gap-1 text-xs">
                          <span>{item.itemName}</span>
                          <input
                            type="number"
                            value={selectionQty[item.id] ?? ""}
                            onChange={(e) => setSelectionQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="0"
                            className="w-12 border border-line px-1 py-0.5 text-right text-xs"
                          />
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 flex items-end gap-2">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={includePm} onChange={(e) => setIncludePm(e.target.checked)} />
                Project Management (hourly)
              </label>
            </div>
            {includePm && (
              <>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">PM Rate ($/hr)</label>
                  <input
                    type="number"
                    value={pmHourlyRate}
                    onChange={(e) => setPmHourlyRate(e.target.value)}
                    className="w-full border border-line px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">PM Est. Hours</label>
                  <input
                    type="number"
                    value={pmEstimatedHours}
                    onChange={(e) => setPmEstimatedHours(e.target.value)}
                    className="w-full border border-line px-2 py-1.5 text-xs"
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Discount</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "" | "percent" | "fixed")}
                className="w-full border border-line px-2 py-1.5 text-xs"
              >
                <option value="">None</option>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed $</option>
              </select>
            </div>
            {discountType && (
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">
                  {discountType === "percent" ? "Discount %" : "Discount $"}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
            )}
          </div>

          <div className="border-t-[1.5px] border-ink pt-3 text-sm">
            <div className="flex justify-between text-ink/70">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{fmtUsd(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-ink/70">
                <span>Discount</span>
                <span className="font-mono tabular-nums">-{fmtUsd(discountAmount)}</span>
              </div>
            )}
            {pmFeeEstimate > 0 && (
              <div className="flex justify-between text-ink/70">
                <span>Project Management (est.)</span>
                <span className="font-mono tabular-nums">{fmtUsd(pmFeeEstimate)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-line pt-1 text-base font-medium text-ink">
              <span>Total</span>
              <span className="font-mono tabular-nums">{fmtUsd(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Quote"}
            </button>
            {error && <span className="text-xs text-warning">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
