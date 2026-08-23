"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectDetail } from "@/lib/projects/types";
import type { Quote } from "@/lib/quotes/types";
import { toIsoDate } from "@/lib/hours/dates";

const TYPES = ["Residential", "Commercial", "Furniture"] as const;
const BILLING_METHODS = ["Fixed Fee", "Hourly", "Commission"] as const;

interface DraftMilestone {
  name: string;
  dueDate: string;
  amount: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return toIsoDate(d);
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function ContractBuilderPanel({
  project,
  quote,
  onClose,
  onCreated,
}: {
  project: ProjectDetail;
  quote: Quote | null;
  onClose: () => void;
  onCreated: (contractId: string) => void;
}) {
  const [signedDate, setSignedDate] = useState(toIsoDate(new Date()));
  const [templateVariant, setTemplateVariant] = useState<(typeof TYPES)[number]>(
    (project.type as (typeof TYPES)[number]) || "Residential"
  );
  const [billingMethod, setBillingMethod] = useState<(typeof BILLING_METHODS)[number]>(
    (project.billingMethod as (typeof BILLING_METHODS)[number]) || "Fixed Fee"
  );
  const [designFeeTotal, setDesignFeeTotal] = useState(quote ? String(quote.total) : "");
  const [discountType, setDiscountType] = useState<"" | "percent" | "fixed">(quote?.discountType ?? "");
  const [discountValue, setDiscountValue] = useState(quote?.discountValue ? String(quote.discountValue) : "");
  const [includePm, setIncludePm] = useState(!!quote?.pmHourlyRate);
  const [pmHourlyRate, setPmHourlyRate] = useState(quote?.pmHourlyRate ? String(quote.pmHourlyRate) : "200");
  const [pmEstimatedHours, setPmEstimatedHours] = useState(quote?.pmEstimatedHours ? String(quote.pmEstimatedHours) : "");
  const [hourlyRate, setHourlyRate] = useState("200");

  // Residential formula inputs
  const [payment3Amount, setPayment3Amount] = useState("500");
  const [payment4Amount, setPayment4Amount] = useState("500");

  // Commercial formula inputs
  const [initialPayment, setInitialPayment] = useState("");
  const [completionPayment, setCompletionPayment] = useState("");

  const [milestones, setMilestones] = useState<DraftMilestone[]>([]);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function generateSchedule() {
    if (templateVariant === "Residential") {
      const total = Number(designFeeTotal || 0);
      const p3 = Number(payment3Amount || 0);
      const p4 = Number(payment4Amount || 0);
      const remainder = Math.max(0, total - p3 - p4);
      const p1 = remainder / 2;
      const p2 = remainder / 2;
      setMilestones([
        { name: "Payment 1 — Signed Contract", dueDate: signedDate, amount: String(Math.round(p1)) },
        { name: "Payment 2 — Construction Documents Sent to GC", dueDate: addDays(signedDate, 30), amount: String(Math.round(p2)) },
        { name: "Payment 3 — Electrical/Plumbing Rough-In Walkthrough", dueDate: addDays(signedDate, 60), amount: String(p3) },
        { name: "Payment 4 — Final Punch Walkthrough", dueDate: addDays(signedDate, 90), amount: String(p4) },
      ]);
    } else if (templateVariant === "Commercial") {
      setMilestones([
        { name: "Initial Payment — Signed Contract", dueDate: signedDate, amount: initialPayment || "0" },
        { name: "Fee Due Upon Substantial Completion", dueDate: addMonths(signedDate, 3), amount: completionPayment || "0" },
      ]);
      setDesignFeeTotal(String(Number(initialPayment || 0) + Number(completionPayment || 0)));
    } else {
      const upfront = includePm ? Number(pmHourlyRate || 0) * Number(pmEstimatedHours || 0) : 0;
      setMilestones([
        { name: "Furniture Invoice — Upfront Estimate", dueDate: signedDate, amount: String(Math.round(upfront)) },
        { name: `Furniture Invoice — ${addMonths(signedDate, 1).slice(0, 7)}`, dueDate: addMonths(signedDate, 1), amount: "" },
        { name: `Furniture Invoice — ${addMonths(signedDate, 2).slice(0, 7)}`, dueDate: addMonths(signedDate, 2), amount: "" },
      ]);
    }
    setGenerated(true);
  }

  function updateMilestone(index: number, patch: Partial<DraftMilestone>) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }
  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }
  function addMilestone() {
    setMilestones((prev) => [...prev, { name: "", dueDate: signedDate, amount: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const supabase = createClient();

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .insert({
        project_id: project.id,
        quote_id: quote?.id ?? null,
        template_variant: templateVariant,
        billing_method: billingMethod,
        discount_type: discountType || null,
        discount_value: discountType ? Number(discountValue || 0) : null,
        pm_hourly_rate: includePm ? Number(pmHourlyRate || 0) : null,
        pm_estimated_hours: includePm ? Number(pmEstimatedHours || 0) : null,
        design_fee_total: designFeeTotal ? Number(designFeeTotal) : null,
        payment3_amount: templateVariant === "Residential" ? Number(payment3Amount || 0) : null,
        payment4_amount: templateVariant === "Residential" ? Number(payment4Amount || 0) : null,
        status: "draft",
      })
      .select("id")
      .single();
    if (contractError) {
      setSaving(false);
      setError(contractError.message);
      return;
    }

    if (milestones.length > 0) {
      const { error: milestonesError } = await supabase.from("milestones").insert(
        milestones.map((m, i) => ({
          project_id: project.id,
          name: m.name.trim() || `Milestone ${i + 1}`,
          sequence_order: i + 1,
          due_date: m.dueDate || null,
          amount_due: m.amount ? Number(m.amount) : null,
          status: "Pending",
        }))
      );
      if (milestonesError) {
        setSaving(false);
        setError(milestonesError.message);
        return;
      }
    }

    const { error: projectError } = await supabase
      .from("projects")
      .update({
        status: "Contract Sent",
        contract_signed_date: signedDate,
        contract_value: designFeeTotal ? Number(designFeeTotal) : null,
        billing_method: billingMethod,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
      })
      .eq("id", project.id);
    if (projectError) {
      setSaving(false);
      setError(projectError.message);
      return;
    }

    setSaving(false);
    onCreated(contract.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h3 className="text-base text-ink">Generate Contract — {project.name}</h3>
          <button onClick={onClose} className="font-mono text-xs uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Signed Date</label>
              <input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Template</label>
              <select
                value={templateVariant}
                onChange={(e) => {
                  setTemplateVariant(e.target.value as (typeof TYPES)[number]);
                  setGenerated(false);
                  setMilestones([]);
                }}
                className="w-full border border-line px-2 py-1.5 text-xs"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Billing Method</label>
              <select
                value={billingMethod}
                onChange={(e) => setBillingMethod(e.target.value as (typeof BILLING_METHODS)[number])}
                className="w-full border border-line px-2 py-1.5 text-xs"
              >
                {BILLING_METHODS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Hourly Rate ($/hr)</label>
              <input
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          {templateVariant === "Residential" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Design Fee Total ($)</label>
                <input
                  type="number"
                  value={designFeeTotal}
                  onChange={(e) => setDesignFeeTotal(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Payment 3 ($, rough-in)</label>
                <input
                  type="number"
                  value={payment3Amount}
                  onChange={(e) => setPayment3Amount(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Payment 4 ($, final punch)</label>
                <input
                  type="number"
                  value={payment4Amount}
                  onChange={(e) => setPayment4Amount(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          {templateVariant === "Commercial" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Initial Payment ($)</label>
                <input
                  type="number"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Fee at Substantial Completion ($)</label>
                <input
                  type="number"
                  value={completionPayment}
                  onChange={(e) => setCompletionPayment(e.target.value)}
                  className="w-full border border-line px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 flex items-end gap-1.5 text-xs">
              <input type="checkbox" checked={includePm} onChange={(e) => setIncludePm(e.target.checked)} />
              Project Management (hourly)
            </label>
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

          <button
            type="button"
            onClick={generateSchedule}
            className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas"
          >
            {generated ? "Regenerate Payment Schedule" : "Generate Payment Schedule"}
          </button>

          {milestones.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-wide text-ink/60">
                  Payment Schedule — edit freely before creating the contract
                </label>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
                >
                  + Add payment
                </button>
              </div>
              <div className="border border-line bg-canvas">
                {milestones.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line p-2 last:border-b-0">
                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(i, { name: e.target.value })}
                      placeholder="Payment name"
                      className="min-w-[200px] flex-1 border border-line px-2 py-1 text-xs"
                    />
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={(e) => updateMilestone(i, { dueDate: e.target.value })}
                      className="border border-line px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      value={m.amount}
                      onChange={(e) => updateMilestone(i, { amount: e.target.value })}
                      placeholder="Amount $"
                      className="w-28 border border-line px-2 py-1 text-right text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="font-mono text-[11px] text-warning underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-right text-xs text-ink/60">
                Total: {fmtUsd(milestones.reduce((s, m) => s + Number(m.amount || 0), 0))}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving || milestones.length === 0}
              className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Contract"}
            </button>
            {error && <span className="text-xs text-warning">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
