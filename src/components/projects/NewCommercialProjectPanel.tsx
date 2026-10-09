"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientOption } from "@/lib/clients/types";
import { resolveClientId } from "@/lib/clients/resolveClient";
import type { SubcontractorRates } from "@/lib/hours/types";
import { effectiveRate } from "@/lib/hours/rates";
import { toIsoDate } from "@/lib/hours/dates";
import { US_STATES } from "@/lib/usStates";
import {
  COMMERCIAL_BILLING_METHODS,
  assignmentInsertRows,
  paymentInsertRows,
  projectInsertRow,
  validateNewCommercial,
  type CommercialBilling,
  type DraftContractor,
  type DraftPayment,
} from "@/lib/projects/newCommercial";

const NEW_CLIENT = "__new__";

const labelClass = "mb-1 block text-[10px] uppercase tracking-wide text-ink/60";
const inputClass = "w-full border border-line px-2 py-1.5 text-xs";

/** Starts a Commercial project directly -- no lead, quote or contract -- for an existing commercial client or a new one. */
export function NewCommercialProjectPanel({
  commercialClients,
  allClients,
  existingProjects,
  contractors,
  onClose,
  onCreated,
}: {
  /** Clients that already have a commercial project, busiest first. */
  commercialClients: ClientOption[];
  /** Every client, so a typed name that already exists is reused instead of duplicated. */
  allClients: ClientOption[];
  existingProjects: { name: string; clientName: string; type: string }[];
  contractors: SubcontractorRates[];
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [state, setState] = useState("FL");
  const [signedDate, setSignedDate] = useState(toIsoDate(new Date()));
  const [billingMethod, setBillingMethod] = useState<CommercialBilling>("Hourly");
  const [hourlyRate, setHourlyRate] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [assigned, setAssigned] = useState<DraftContractor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isNewClient = clientId === NEW_CLIENT;
  const selectedClient = commercialClients.find((c) => c.id === clientId);
  const clientName = isNewClient ? newClientName.trim() : (selectedClient?.name ?? "");

  // A real project name from this client shows the naming pattern they already use.
  const exampleName = existingProjects.find((p) => p.type === "Commercial" && p.clientName === clientName)?.name;

  function updatePayment(index: number, patch: Partial<DraftPayment>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function updateContractor(index: number, patch: Partial<DraftContractor>) {
    setAssigned((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const draft = {
      clientName,
      projectName,
      state,
      signedDate,
      billingMethod,
      hourlyRate,
      fixedFee,
      contractValue,
      payments,
      contractors: assigned,
    };
    const problem = validateNewCommercial(draft);
    if (problem) return setError(problem);

    setSaving(true);
    const supabase = createClient();

    const clientResult = await resolveClientId(
      supabase,
      allClients,
      isNewClient ? { id: null, name: newClientName } : { id: clientId, name: clientName }
    );
    if ("error" in clientResult) {
      setSaving(false);
      return setError(clientResult.error);
    }
    const resolvedClientId = clientResult.id;
    const createdClient =
      isNewClient && !allClients.some((c) => c.name.toLowerCase() === newClientName.trim().toLowerCase());

    // The project, its payments and its contractors are saved as separate
    // requests, so if a later one fails, take back what was already created
    // instead of leaving a half-built project behind.
    async function undo(projectId?: string) {
      if (projectId) await supabase.from("projects").delete().eq("id", projectId);
      if (createdClient) await supabase.from("clients").delete().eq("id", resolvedClientId);
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert(projectInsertRow(draft, resolvedClientId))
      .select("id")
      .single();
    if (projectError) {
      await undo();
      setSaving(false);
      return setError(
        projectError.code === "23505"
          ? `${clientName} already has a project named "${projectName.trim()}". Enter a different project name.`
          : projectError.message
      );
    }

    if (payments.length > 0) {
      const { error: paymentsError } = await supabase.from("milestones").insert(paymentInsertRows(project.id, payments));
      if (paymentsError) {
        await undo(project.id);
        setSaving(false);
        return setError(`Couldn't save the payment schedule, so nothing was created: ${paymentsError.message}`);
      }
    }

    if (assigned.length > 0) {
      const { error: assignError } = await supabase
        .from("project_subcontractors")
        .insert(assignmentInsertRows(project.id, assigned, contractors));
      if (assignError) {
        await undo(project.id);
        setSaving(false);
        return setError(`Couldn't assign the contractors, so nothing was created: ${assignError.message}`);
      }
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
          <h3 className="text-base text-ink">New Commercial Project</h3>
          <button onClick={onClose} className="font-mono text-xs uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">Select a commercial client…</option>
                {commercialClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_CLIENT}>＋ New client…</option>
              </select>
              {isNewClient && (
                <>
                  <input
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="New client name"
                    className={`${inputClass} mt-2`}
                  />
                  <p className="mt-1 text-[11px] text-ink/40">A client that already exists under this name is reused, not duplicated.</p>
                </>
              )}
            </div>
            <div>
              <label className={labelClass}>Project Name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={exampleName ? `e.g. ${exampleName}` : undefined}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Signed Date</label>
              <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/60">Billing</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Billing Method</label>
                <select
                  value={billingMethod}
                  onChange={(e) => setBillingMethod(e.target.value as CommercialBilling)}
                  className={inputClass}
                >
                  {COMMERCIAL_BILLING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {billingMethod === "Hourly" ? (
                <div>
                  <label className={labelClass}>Hourly Rate ($/hr)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Fixed Fee ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Contract Value ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wide text-ink/60">
                Payment Schedule — name is optional, a blank one becomes e.g. “Jun 2026 Payment”
              </label>
              <button
                type="button"
                onClick={() => setPayments((prev) => [...prev, { name: "", dueDate: signedDate, amount: "" }])}
                className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
              >
                + Add payment
              </button>
            </div>
            {payments.length === 0 ? (
              <div className="border border-line bg-canvas p-3 text-xs text-ink/50">
                No payments yet — add them now, or later from the project page.
              </div>
            ) : (
              <div className="border border-line bg-canvas">
                {payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line p-2 last:border-b-0">
                    <input
                      value={p.name}
                      onChange={(e) => updatePayment(i, { name: e.target.value })}
                      placeholder="Payment name"
                      className="min-w-[160px] flex-1 border border-line px-2 py-1 text-xs"
                    />
                    <input
                      type="date"
                      value={p.dueDate}
                      onChange={(e) => updatePayment(i, { dueDate: e.target.value })}
                      className="border border-line px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.amount}
                      onChange={(e) => updatePayment(i, { amount: e.target.value })}
                      placeholder="Amount $"
                      className="w-28 border border-line px-2 py-1 text-right text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setPayments((prev) => prev.filter((_, j) => j !== i))}
                      className="font-mono text-[11px] text-warning underline underline-offset-2"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wide text-ink/60">
                Contractors & Allocated Hours — a contractor can only log time on projects assigned to them
              </label>
              <button
                type="button"
                onClick={() => setAssigned((prev) => [...prev, { subcontractorId: "", allocatedHours: "", hourlyRate: "" }])}
                className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2"
              >
                + Add contractor
              </button>
            </div>
            {assigned.length === 0 ? (
              <div className="border border-line bg-canvas p-3 text-xs text-ink/50">
                No contractors yet — add them now, or later from the project page.
              </div>
            ) : (
              <div className="border border-line bg-canvas">
                {assigned.map((c, i) => {
                  const defaultRate = effectiveRate(
                    contractors.find((r) => r.id === c.subcontractorId),
                    "Commercial"
                  );
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 border-b border-line p-2 last:border-b-0">
                      <select
                        value={c.subcontractorId}
                        onChange={(e) => updateContractor(i, { subcontractorId: e.target.value })}
                        className="min-w-[160px] flex-1 border border-line px-2 py-1 text-xs"
                      >
                        <option value="">Select contractor…</option>
                        {contractors
                          .filter((r) => r.id === c.subcontractorId || !assigned.some((a) => a.subcontractorId === r.id))
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={c.allocatedHours}
                        onChange={(e) => updateContractor(i, { allocatedHours: e.target.value })}
                        placeholder="Alloc. hrs"
                        className="w-24 border border-line px-2 py-1 text-right text-xs"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.hourlyRate}
                        onChange={(e) => updateContractor(i, { hourlyRate: e.target.value })}
                        placeholder={defaultRate !== null ? `$${defaultRate}/hr` : "Rate $/hr"}
                        className="w-24 border border-line px-2 py-1 text-right text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setAssigned((prev) => prev.filter((_, j) => j !== i))}
                        className="font-mono text-[11px] text-warning underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-ink/40">Leave a rate blank to use the contractor’s Commercial rate.</p>
          </div>

          <p className="text-[11px] text-ink/40">
            Commercial projects skip quotes and contracts: this creates an active project, Under Contract, that you can finish on its
            own page (scope %, billing changes, more payments or contractors).
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
