"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/leads/types";
import type { ReferralSource } from "@/lib/dashboard/types";
import type { SelectionCatalogItem } from "@/lib/quotes/types";
import type { ClientOption } from "@/lib/clients/types";
import { resolveClientId } from "@/lib/clients/resolveClient";
import { QUOTE_TASK_CATALOG, SCOPE_TO_SELECTION_CATEGORIES } from "@/lib/scope";
import { EDITABLE_QUOTE_STATUSES, mergeLineItems, type DraftLineItem } from "@/lib/quotes/edit";
import { INTERNAL_SECTIONS } from "@/lib/quotes/pdfScope";
import { loadQuoteForEdit, type ExistingQuote } from "@/lib/quotes/editLoader";
import { toIsoDate } from "@/lib/hours/dates";
import { isValidBudgetRange, isValidEmail, isValidPhone } from "@/lib/validation";
import { US_STATES } from "@/lib/usStates";
import { ScopePills, ReferralSourceSelect } from "./LeadsTab";
import { ClientPicker } from "./ClientPicker";

// Commercial work isn't quoted here -- it starts from Projects -> New Commercial Project.
const TYPES = ["Residential", "Furniture"] as const;
type QuoteType = (typeof TYPES)[number];
const asQuoteType = (value: string | null | undefined): QuoteType =>
  (TYPES as readonly string[]).includes(value ?? "") ? (value as QuoteType) : "Residential";
const FINISH_SELECTIONS_TASK = "Finish Selections";

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Only the categories whose scope tag is actually selected (e.g. Kitchen/Appliances require "Kitchen Remodel") -- nothing shows until a relevant scope is tagged. */
function relevantCategories(scopeTags: string[], allCategories: string[]): string[] {
  const mapped = new Set(scopeTags.flatMap((tag) => SCOPE_TO_SELECTION_CATEGORIES[tag] ?? []));
  return allCategories.filter((c) => mapped.has(c));
}

interface QuotePanelProps {
  lead: Lead | null;
  selectionCatalog: SelectionCatalogItem[];
  referralSources: ReferralSource[];
  clients: ClientOption[];
  onClose: () => void;
  onCreated: (result: { lead: Lead; projectId: string; quoteId: string; total: number }) => void;
}

/** Builds a new quote, or -- given `editQuoteId` -- reopens a saved one pre-filled with its hours, rates, selections and terms. */
export function QuoteBuilderPanel({ editQuoteId, ...props }: QuotePanelProps & { editQuoteId?: string }) {
  const [existing, setExisting] = useState<ExistingQuote | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!editQuoteId) return;
    let cancelled = false;
    loadQuoteForEdit(createClient(), editQuoteId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setLoadError(result.error);
      else setExisting(result);
    });
    return () => {
      cancelled = true;
    };
  }, [editQuoteId]);

  if (!editQuoteId) return <QuoteForm {...props} />;
  if (existing) return <QuoteForm {...props} existing={existing} />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={props.onClose}>
      <div className="w-full max-w-md border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        {loadError ? (
          <>
            <p className="mb-4 text-sm text-warning">{loadError}</p>
            <button onClick={props.onClose} className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas">
              Close
            </button>
          </>
        ) : (
          <p className="text-sm text-ink/60">Loading quote…</p>
        )}
      </div>
    </div>
  );
}

function QuoteForm({
  lead,
  selectionCatalog,
  referralSources,
  clients,
  existing,
  onClose,
  onCreated,
}: QuotePanelProps & { existing?: ExistingQuote }) {
  // Standalone intake fields -- only used and shown when there's no lead
  // yet (e.g. a client calling in directly rather than coming from the
  // Leads pipeline). When a lead is passed, its own data is used as-is.
  const [name, setName] = useState(lead?.name ?? "");
  const [client, setClient] = useState<{ id: string | null; name: string }>({ id: null, name: lead?.name ?? "" });
  // Blank means "use the contact name" when creating; when editing it starts as the saved name.
  const [projectName, setProjectName] = useState(existing?.projectName ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [address, setAddress] = useState(lead?.address ?? "");
  const [city, setCity] = useState(lead?.city ?? "");
  const [state, setState] = useState(lead?.state ?? "");
  const [zip, setZip] = useState(lead?.zip ?? "");
  const [budgetRange, setBudgetRange] = useState(lead?.budgetRange ?? "");
  const [scopeTags, setScopeTags] = useState<string[]>(lead?.scopeTags ?? []);
  const [referralSourceId, setReferralSourceId] = useState(lead?.referralSourceId ?? "");
  const [referralSourceName, setReferralSourceName] = useState<string | null>(lead?.referralSourceName ?? null);
  const [localReferralSources, setLocalReferralSources] = useState<ReferralSource[]>([]);

  const [projectType, setProjectType] = useState<QuoteType>(asQuoteType(existing?.projectType ?? lead?.projectType));
  const [lineItems, setLineItems] = useState<DraftLineItem[]>(() =>
    mergeLineItems(QUOTE_TASK_CATALOG, existing?.lineItems ?? [], FINISH_SELECTIONS_TASK)
  );
  const [selectionQty, setSelectionQty] = useState<Record<string, string>>(existing?.selectionQty ?? {});
  const [includePm, setIncludePm] = useState(existing?.includePm ?? false);
  const [pmHourlyRate, setPmHourlyRate] = useState(existing?.pmHourlyRate ?? "200");
  const [pmEstimatedHours, setPmEstimatedHours] = useState(existing?.pmEstimatedHours ?? "");
  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">(existing?.discountType ?? "");
  const [discountValue, setDiscountValue] = useState(existing?.discountValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finishSelectionsRate = QUOTE_TASK_CATALOG.find((t) => t.taskName === FINISH_SELECTIONS_TASK)!.rate;

  const allCategories = useMemo(() => Array.from(new Set(selectionCatalog.map((c) => c.category))), [selectionCatalog]);
  const visibleCategories = useMemo(
    () => relevantCategories(scopeTags, allCategories),
    [scopeTags, allCategories]
  );

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

  function buildLineRows(quoteId: string) {
    const rows = lineItems
      .filter((li) => Number(li.hours || 0) > 0)
      .map((li, i) => ({
        quote_id: quoteId,
        section: li.section,
        task_name: li.taskName,
        hours: Number(li.hours),
        rate: Number(li.rate),
        amount: Number(li.hours) * Number(li.rate),
        sequence_order: i + 1,
      }));
    if (finishSelectionsHours > 0) {
      rows.push({
        quote_id: quoteId,
        section: "FFE",
        task_name: FINISH_SELECTIONS_TASK,
        hours: finishSelectionsHours,
        rate: finishSelectionsRate,
        amount: finishSelectionsHours * finishSelectionsRate,
        sequence_order: rows.length + 1,
      });
    }
    return rows;
  }

  function buildSelectionRows(quoteId: string) {
    return selectionCatalog
      .filter((item) => Number(selectionQty[item.id] || 0) > 0)
      .map((item) => ({
        quote_id: quoteId,
        catalog_item_id: item.id,
        qty: Number(selectionQty[item.id]),
        hours: Number(selectionQty[item.id]) * item.defaultHours,
      }));
  }

  // Saves changes to an existing quote. New line items and selections are
  // written first and the old ones removed afterwards, so a failure part-way
  // never leaves the quote with nothing in it.
  async function saveEdit(saved: ExistingQuote) {
    const supabase = createClient();
    const finalProjectName = projectName.trim() || saved.projectName;

    if (finalProjectName !== saved.projectName) {
      const { data: clash, error: clashError } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", saved.clientId)
        .eq("name", finalProjectName)
        .neq("id", saved.projectId)
        .limit(1);
      if (clashError) return setError(clashError.message);
      if (clash && clash.length > 0) {
        return setError(`${saved.clientName} already has a project named "${finalProjectName}". Enter a different project name.`);
      }
    }

    const [oldLines, oldSelections] = await Promise.all([
      supabase.from("quote_line_items").select("id").eq("quote_id", saved.quoteId),
      supabase.from("quote_selections").select("id").eq("quote_id", saved.quoteId),
    ]);
    const lookupError = oldLines.error ?? oldSelections.error;
    if (lookupError) return setError(lookupError.message);

    const { data: updated, error: quoteError } = await supabase
      .from("quotes")
      .update({
        project_type: projectType,
        discount_type: discountType || null,
        discount_value: discountType ? Number(discountValue || 0) : null,
        pm_hourly_rate: includePm ? Number(pmHourlyRate || 0) : null,
        pm_estimated_hours: includePm ? Number(pmEstimatedHours || 0) : null,
        subtotal,
        total,
      })
      .eq("id", saved.quoteId)
      .in("status", EDITABLE_QUOTE_STATUSES)
      .select("id");
    if (quoteError) return setError(quoteError.message);
    if (!updated || updated.length === 0) {
      return setError("This quote was accepted in the meantime, so it can't be changed any more.");
    }

    const lineRows = buildLineRows(saved.quoteId);
    if (lineRows.length > 0) {
      const { error: insertError } = await supabase.from("quote_line_items").insert(lineRows);
      if (insertError) return setError(insertError.message);
    }
    const selectionRows = buildSelectionRows(saved.quoteId);
    if (selectionRows.length > 0) {
      const { error: insertError } = await supabase.from("quote_selections").insert(selectionRows);
      if (insertError) return setError(insertError.message);
    }

    const staleLineIds = (oldLines.data ?? []).map((r) => r.id);
    if (staleLineIds.length > 0) {
      const { error: deleteError } = await supabase.from("quote_line_items").delete().in("id", staleLineIds);
      if (deleteError) return setError(deleteError.message);
    }
    const staleSelectionIds = (oldSelections.data ?? []).map((r) => r.id);
    if (staleSelectionIds.length > 0) {
      const { error: deleteError } = await supabase.from("quote_selections").delete().in("id", staleSelectionIds);
      if (deleteError) return setError(deleteError.message);
    }

    const { error: projectError } = await supabase
      .from("projects")
      .update({ name: finalProjectName, type: projectType })
      .eq("id", saved.projectId);
    if (projectError) return setError(projectError.code === "23505" ? "That project name is already used by this client." : projectError.message);

    onCreated({ lead: lead!, projectId: saved.projectId, quoteId: saved.quoteId, total });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (existing) {
      setSaving(true);
      await saveEdit(existing);
      setSaving(false);
      return;
    }
    if (!lead && !name.trim()) return setError("Name is required.");
    if (!lead && !isValidBudgetRange(budgetRange)) return setError('Budget should be a dollar amount or range, e.g. "$10k–$20k".');
    if (!lead && !isValidEmail(email)) return setError("Enter a valid email address.");
    if (!lead && !isValidPhone(phone)) return setError("Enter a valid phone number.");
    if (!client.name.trim()) return setError("Client is required.");

    setSaving(true);
    const supabase = createClient();

    // Resolve the client and check the project name up front, before a lead
    // or project is created, so a name clash can't leave a half-built
    // duplicate behind.
    const clientResult = await resolveClientId(supabase, clients, client);
    if ("error" in clientResult) {
      setSaving(false);
      setError(clientResult.error);
      return;
    }

    const finalProjectName = projectName.trim() || (lead?.name ?? name.trim());
    const nameClashMessage = `${client.name.trim()} already has a project named "${finalProjectName}". Enter a different project name.`;
    const { data: clash, error: clashError } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", clientResult.id)
      .eq("name", finalProjectName)
      .limit(1);
    if (clashError) {
      setSaving(false);
      setError(clashError.message);
      return;
    }
    if (clash && clash.length > 0) {
      setSaving(false);
      setError(nameClashMessage);
      return;
    }

    let effectiveLead: Lead;
    if (lead) {
      effectiveLead = lead;
    } else {
      const finalReferralSourceId = referralSourceId || null;
      const finalReferralSourceName = referralSourceName;

      const { data: newLead, error: leadInsertError } = await supabase
        .from("leads")
        .insert({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          project_type: projectType,
          scope_tags: scopeTags,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state || null,
          zip: zip.trim() || null,
          budget_range: budgetRange.trim() || null,
          referral_source_id: finalReferralSourceId,
          status: "Quote Sent",
        })
        .select("id, created_at")
        .single();
      if (leadInsertError) {
        setSaving(false);
        setError(leadInsertError.message);
        return;
      }

      effectiveLead = {
        id: newLead.id,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        projectType,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state || null,
        zip: zip.trim() || null,
        budgetRange: budgetRange.trim() || null,
        timelineStartMonth: null,
        timelineEndMonth: null,
        referralSourceId: finalReferralSourceId,
        referralSourceName: finalReferralSourceName,
        notes: null,
        scopeTags,
        status: "Quote Sent",
        lastContactedDate: null,
        createdAt: newLead.created_at,
        convertedSowId: null,
        convertedProjectId: null,
      };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: clientResult.id,
        name: finalProjectName,
        type: projectType,
        state: effectiveLead.state,
        referral_source_id: effectiveLead.referralSourceId,
        billing_method: "Fixed Fee",
        active: true,
        status: "Quoted",
      })
      .select("id")
      .single();
    if (projectError) {
      setSaving(false);
      setError(projectError.code === "23505" ? nameClashMessage : projectError.message);
      return;
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        lead_id: effectiveLead.id,
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

    const rows = buildLineRows(quote.id);
    if (rows.length > 0) {
      const { error: lineItemsError } = await supabase.from("quote_line_items").insert(rows);
      if (lineItemsError) {
        setSaving(false);
        setError(lineItemsError.message);
        return;
      }
    }

    const selectionRows = buildSelectionRows(quote.id);
    if (selectionRows.length > 0) {
      const { error: selectionsError } = await supabase.from("quote_selections").insert(selectionRows);
      if (selectionsError) {
        setSaving(false);
        setError(selectionsError.message);
        return;
      }
    }

    let convertedSowId = effectiveLead.convertedSowId;
    if (!convertedSowId) {
      const { data: sow } = await supabase
        .from("sow_sent")
        .insert({ date_sent: toIsoDate(new Date()), prospect_name: effectiveLead.name, notes: effectiveLead.notes, status: "Open" })
        .select("id")
        .single();
      convertedSowId = sow?.id ?? null;
    }

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({ status: "Quote Sent", converted_project_id: project.id, converted_sow_id: convertedSowId })
      .eq("id", effectiveLead.id);
    if (leadUpdateError) {
      setSaving(false);
      setError(leadUpdateError.message);
      return;
    }

    setSaving(false);
    onCreated({
      lead: { ...effectiveLead, status: "Quote Sent", convertedProjectId: project.id, convertedSowId },
      projectId: project.id,
      quoteId: quote.id,
      total,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h3 className="text-base text-ink">
            {existing ? "Edit Quote" : "Build Quote"}
            {lead ? ` — ${lead.name}` : ""}
          </h3>
          <button onClick={onClose} className="font-mono text-xs uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {!lead && (
            <div className="border border-line bg-canvas p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/60">
                Client Info — no lead selected, this will create one
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">State</label>
                  <select value={state} onChange={(e) => setState(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs">
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Zip</label>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Client Budget</label>
                  <input
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    placeholder="e.g. $10k–$20k"
                    className="w-full border border-line px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Referral Source</label>
                  <ReferralSourceSelect
                    referralSources={[...referralSources, ...localReferralSources]}
                    value={referralSourceId}
                    onChange={(id, sourceName) => {
                      setReferralSourceId(id);
                      setReferralSourceName(sourceName ?? null);
                    }}
                    onSourceCreated={(source) => setLocalReferralSources((prev) => [...prev, source])}
                  />
                </div>
              </div>
              {projectType === "Residential" && (
                <div className="mt-3">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Scope of Interest</label>
                  <ScopePills value={scopeTags} onChange={setScopeTags} />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {existing ? (
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Client</label>
                <div className="w-full border border-line bg-canvas px-2 py-1.5 text-xs text-ink/70">{existing.clientName}</div>
              </div>
            ) : (
              <ClientPicker clients={clients} value={client} onChange={setClient} />
            )}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Project Name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={existing?.projectName ?? lead?.name ?? (name.trim() || "e.g. Smith Kitchen Remodel")}
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
              <p className="mt-1 text-[10px] text-ink/50">
                {existing ? "Changing this renames the project." : "Leave blank to use the contact name. You can rename it later."}
              </p>
            </div>
          </div>

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
                  <span
                    className="w-40 flex-shrink-0 font-mono text-[9.5px] uppercase text-ink/40"
                    title={INTERNAL_SECTIONS.includes(li.section) ? "Counted in the cost build-up, but not printed on the client's PDF" : undefined}
                  >
                    {li.section}
                    {INTERNAL_SECTIONS.includes(li.section) && " · internal"}
                  </span>
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
              Finish Selections — filtered to the scope tagged above — quantity per item, rolls up into one FFE line at{" "}
              {fmtUsd(finishSelectionsRate)}/hr (currently {finishSelectionsHours} hrs = {fmtUsd(finishSelectionsHours * finishSelectionsRate)})
            </label>
            {visibleCategories.length === 0 ? (
              <div className="border border-line bg-canvas p-3 text-xs text-ink/50">
                Tag a relevant scope above (e.g. Kitchen Remodel or Bathroom Remodel) to show finish selections here.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-line bg-canvas">
                {visibleCategories.map((cat) => (
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
            )}
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
              {saving ? (existing ? "Saving…" : "Creating…") : existing ? "Save Changes" : "Create Quote"}
            </button>
            {error && <span className="text-xs text-warning">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
