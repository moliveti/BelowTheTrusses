"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MilestoneRow } from "@/lib/projects/types";
import { fmtUsd } from "@/lib/dashboard/format";

const STATUSES = ["Pending", "Invoiced", "Paid", "Overdue"] as const;

export function MilestoneSection({
  projectId,
  initialMilestones,
  contractValue,
  totalCost,
  hasUnknownRate,
  hasHoursLogged,
}: {
  projectId: string;
  initialMilestones: MilestoneRow[];
  contractValue: number | null;
  totalCost: number;
  hasUnknownRate: boolean;
  hasHoursLogged: boolean;
}) {
  const [milestones, setMilestones] = useState(initialMilestones);

  const totalCollected = useMemo(() => milestones.reduce((s, m) => s + (m.amountPaid ?? 0), 0), [milestones]);
  const profitability = totalCollected - totalCost;

  function patchMilestone(id: string, patch: Partial<MilestoneRow>) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function updateField(id: string, column: string, value: string, patch: Partial<MilestoneRow>) {
    const supabase = createClient();
    const { error } = await supabase.from("milestones").update({ [column]: value || null }).eq("id", id);
    if (!error) patchMilestone(id, patch);
  }

  async function markPaid(m: MilestoneRow) {
    const today = new Date().toISOString().slice(0, 10);
    const amount = m.amountPaid ?? m.amountDue ?? 0;
    const supabase = createClient();
    const { error } = await supabase
      .from("milestones")
      .update({ paid_date: today, amount_paid: amount, status: "Paid" })
      .eq("id", m.id);
    if (!error) patchMilestone(m.id, { paidDate: today, amountPaid: amount, status: "Paid" });
  }

  async function deleteMilestone(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("milestones").delete().eq("id", id);
    if (!error) setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function addMilestone(m: MilestoneRow) {
    setMilestones((prev) => [...prev, m].sort((a, b) => a.sequenceOrder - b.sequenceOrder));
  }

  return (
    <>
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Original Proposal" value={contractValue !== null ? fmtUsd(contractValue) : "—"} />
        <Stat label="Total Collected" value={fmtUsd(totalCollected)} />
        <Stat
          label="Total Contracted Cost"
          value={!hasHoursLogged ? "—" : fmtUsd(totalCost)}
          flag={hasUnknownRate}
        />
        <Stat label="Profitability" value={fmtUsd(profitability)} accent={profitability >= 0 ? "positive" : "warning"} />
      </section>

      <section className="mb-8">
        <h3 className="mb-3 border-b-[1.5px] border-ink pb-2 font-mono text-xs uppercase tracking-wide text-ink/60">
          Milestones &amp; Payments
        </h3>
        {milestones.length === 0 ? (
          <div className="mb-4 border border-line bg-surface p-4 text-sm text-ink/50">No milestones recorded.</div>
        ) : (
          <div className="mb-4 overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Due</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Amount Due</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid Date</th>
                  <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Amount Paid</th>
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="date"
                        defaultValue={m.dueDate ?? ""}
                        onBlur={(e) => updateField(m.id, "due_date", e.target.value, { dueDate: e.target.value || null })}
                        className="w-32 border border-line px-1.5 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        defaultValue={m.amountDue ?? ""}
                        onBlur={(e) =>
                          updateField(m.id, "amount_due", e.target.value, {
                            amountDue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-24 border border-line px-1.5 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="date"
                        defaultValue={m.paidDate ?? ""}
                        onBlur={(e) => updateField(m.id, "paid_date", e.target.value, { paidDate: e.target.value || null })}
                        className="w-32 border border-line px-1.5 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        defaultValue={m.amountPaid ?? ""}
                        onBlur={(e) =>
                          updateField(m.id, "amount_paid", e.target.value, {
                            amountPaid: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-24 border border-line px-1.5 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-left">
                      <select
                        value={m.status}
                        onChange={(e) => updateField(m.id, "status", e.target.value, { status: e.target.value })}
                        className="border border-line px-1.5 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {m.status !== "Paid" && (
                        <button
                          onClick={() => markPaid(m)}
                          className="mr-2 font-mono text-[11px] text-positive underline underline-offset-2"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        className="font-mono text-[11px] text-warning underline underline-offset-2"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddMilestoneForm projectId={projectId} nextSequence={milestones.length + 1} onAdded={addMilestone} />
      </section>
    </>
  );
}

function AddMilestoneForm({
  projectId,
  nextSequence,
  onAdded,
}: {
  projectId: string;
  nextSequence: number;
  onAdded: (m: MilestoneRow) => void;
}) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [markPaidNow, setMarkPaidNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required.");
    const due = amountDue === "" ? null : Number(amountDue);

    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error: insertError } = await supabase
      .from("milestones")
      .insert({
        project_id: projectId,
        name: name.trim(),
        sequence_order: nextSequence,
        due_date: dueDate || null,
        amount_due: due,
        paid_date: markPaidNow ? today : null,
        amount_paid: markPaidNow ? due : null,
        status: markPaidNow ? "Paid" : "Pending",
      })
      .select("id")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    onAdded({
      id: data.id,
      name: name.trim(),
      sequenceOrder: nextSequence,
      dueDate: dueDate || null,
      amountDue: due,
      paidDate: markPaidNow ? today : null,
      amountPaid: markPaidNow ? due : null,
      status: markPaidNow ? "Paid" : "Pending",
    });
    setName("");
    setDueDate("");
    setAmountDue("");
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border border-line bg-surface p-4 sm:grid-cols-5">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aug 2026 Payment"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Due Date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Amount ($)</label>
        <input
          type="number"
          value={amountDue}
          onChange={(e) => setAmountDue(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div className="flex items-end pb-1.5">
        <label className="flex items-center gap-1.5 text-xs text-ink/70">
          <input type="checkbox" checked={markPaidNow} onChange={(e) => setMarkPaidNow(e.target.checked)} />
          Mark paid today
        </label>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <span className="col-span-2 text-xs text-warning sm:col-span-5">{error}</span>}
    </form>
  );
}

function Stat({
  label,
  value,
  flag,
  accent,
}: {
  label: string;
  value: string;
  flag?: boolean;
  accent?: "positive" | "warning";
}) {
  const valueClass = accent === "positive" ? "text-positive" : accent === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`font-mono text-lg tabular-nums ${valueClass}`}>
        {value}
        {flag && <span className="ml-1 text-warning">*</span>}
      </div>
    </div>
  );
}
