"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/leads/types";
import type { MilestoneTemplateGroup } from "@/lib/milestoneTemplates/types";
import { toIsoDate } from "@/lib/hours/dates";

const TYPES = ["Residential", "Commercial", "Furniture"] as const;
const BILLING_METHODS = ["Fixed Fee", "Hourly", "Commission"] as const;
const BLANK_TEMPLATE = "__blank__";

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

export function ProjectKickoffPanel({
  lead,
  milestoneTemplates,
  onClose,
  onCreated,
}: {
  lead: Lead;
  milestoneTemplates: MilestoneTemplateGroup[];
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [signedDate, setSignedDate] = useState(toIsoDate(new Date()));
  const [projectName, setProjectName] = useState(lead.name);
  const [clientName, setClientName] = useState(lead.name);
  const [projectType, setProjectType] = useState<(typeof TYPES)[number]>(
    (lead.projectType as (typeof TYPES)[number]) || "Residential"
  );
  const [contractValue, setContractValue] = useState("");
  const [billingMethod, setBillingMethod] = useState<(typeof BILLING_METHODS)[number]>("Fixed Fee");
  const [templateKey, setTemplateKey] = useState(BLANK_TEMPLATE);
  const [milestones, setMilestones] = useState<DraftMilestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const templatesForType = milestoneTemplates.filter((t) => t.projectType === projectType);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    if (key === BLANK_TEMPLATE) {
      setMilestones([]);
      return;
    }
    const [type, name] = key.split("::");
    const group = milestoneTemplates.find((t) => t.projectType === type && t.templateName === name);
    if (!group) return;
    const value = contractValue ? Number(contractValue) : null;
    setMilestones(
      group.steps
        .slice()
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((step) => ({
          name: step.name,
          dueDate: addDays(signedDate, step.offsetDays),
          amount: value !== null ? String(Math.round(value * step.percentOfTotal)) : "",
        }))
    );
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
    if (!projectName.trim()) return setError("Project name is required.");
    if (!clientName.trim()) return setError("Client name is required.");

    setSaving(true);
    const supabase = createClient();
    const value = contractValue ? Number(contractValue) : null;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert({ name: clientName.trim() }, { onConflict: "name" })
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
        name: projectName.trim(),
        type: projectType,
        state: lead.state,
        referral_source_id: lead.referralSourceId,
        contract_signed_date: signedDate,
        contract_value: value,
        billing_method: billingMethod,
        active: true,
      })
      .select("id")
      .single();
    if (projectError) {
      setSaving(false);
      setError(projectError.message);
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

    const { error: leadError } = await supabase
      .from("leads")
      .update({ status: "Signed Contract", converted_project_id: project.id })
      .eq("id", lead.id);
    if (leadError) {
      setSaving(false);
      setError(leadError.message);
      return;
    }

    if (lead.convertedSowId) {
      await supabase
        .from("sow_sent")
        .update({ status: "Converted", converted_project_id: project.id })
        .eq("id", lead.convertedSowId);
    }

    setSaving(false);
    onCreated(project.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h3 className="text-base text-ink">Kick Off Project — {lead.name}</h3>
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
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Project Type</label>
              <select
                value={projectType}
                onChange={(e) => {
                  setProjectType(e.target.value as (typeof TYPES)[number]);
                  setTemplateKey(BLANK_TEMPLATE);
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
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Contract Value ($)</label>
              <input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="Optional"
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Project Name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border border-line px-2 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">
              Milestone Template — enter a contract value above first if you want amounts auto-filled
            </label>
            <select
              value={templateKey}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full border border-line px-2 py-1.5 text-xs"
            >
              <option value={BLANK_TEMPLATE}>Start blank</option>
              {templatesForType.map((t) => (
                <option key={`${t.projectType}::${t.templateName}`} value={`${t.projectType}::${t.templateName}`}>
                  {t.templateName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wide text-ink/60">
                Milestones — edit, remove, or add as needed; some steps may not apply to this project
              </label>
              <button
                type="button"
                onClick={addMilestone}
                className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
              >
                + Add milestone
              </button>
            </div>
            {milestones.length === 0 ? (
              <div className="border border-line bg-canvas p-3 text-xs text-ink/50">
                No milestones yet — pick a template above or add one manually.
              </div>
            ) : (
              <div className="border border-line bg-canvas">
                {milestones.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line p-2 last:border-b-0">
                    <input
                      value={m.name}
                      onChange={(e) => updateMilestone(i, { name: e.target.value })}
                      placeholder="Milestone name"
                      className="min-w-[160px] flex-1 border border-line px-2 py-1 text-xs"
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
            )}
          </div>

          <p className="text-[11px] text-ink/40">
            Reference — general terms: hourly work is billed monthly at end of month; all invoices are due upon receipt.
          </p>

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Project"}
            </button>
            {error && <span className="text-xs text-warning">{error}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
