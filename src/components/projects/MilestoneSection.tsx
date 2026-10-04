"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MilestoneRow } from "@/lib/projects/types";
import { fmtUsd } from "@/lib/dashboard/format";
import { useFieldStatus } from "@/hooks/useFieldStatus";
import { FieldStatusBadge } from "@/components/FieldStatusBadge";
import { CollapsibleSection } from "@/components/CollapsibleSection";

const STATUSES = ["Pending", "Invoiced", "Paid", "Overdue"] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MilestoneSection({
  projectId,
  initialMilestones,
  initialActive,
  contractValue,
  totalCost,
  hasUnknownRate,
  hasHoursLogged,
}: {
  projectId: string;
  initialMilestones: MilestoneRow[];
  initialActive: boolean;
  contractValue: number | null;
  totalCost: number;
  hasUnknownRate: boolean;
  hasHoursLogged: boolean;
}) {
  const router = useRouter();
  const [milestones, setMilestones] = useState(initialMilestones);
  const [active, setActive] = useState(initialActive);
  const [togglingActive, setTogglingActive] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const fieldStatus = useFieldStatus();

  const totalCollected = useMemo(() => milestones.reduce((s, m) => s + (m.amountPaid ?? 0), 0), [milestones]);
  const pendingBalance = useMemo(
    () => milestones.reduce((s, m) => s + Math.max(0, (m.amountDue ?? 0) - (m.amountPaid ?? 0)), 0),
    [milestones]
  );
  const profitability = totalCollected - totalCost;
  const fullyPaid = contractValue !== null && totalCollected >= contractValue;

  function patchMilestone(id: string, patch: Partial<MilestoneRow>) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  // Shared save path for every editable milestone field. Marking a milestone
  // Paid (via the Status select) or giving it a Paid Date, while no amount
  // has ever been recorded, auto-fills amount_paid (= amount_due) -- without
  // this the Pending Balance keeps showing the full amount outstanding even
  // though the row reads "Paid".
  async function updateField(m: MilestoneRow, column: string, value: string, patch: Partial<MilestoneRow>) {
    const key = `${m.id}:${column}`;
    const payload: Record<string, string | number | null> = { [column]: value || null };
    let finalPatch = patch;

    const becomingPaidStatus = column === "status" && value === "Paid";
    const gettingPaidDate = column === "paid_date" && value !== "";
    if ((becomingPaidStatus || gettingPaidDate) && m.amountPaid === null) {
      const amount = m.amountDue ?? 0;
      payload.amount_paid = amount;
      finalPatch = { ...finalPatch, amountPaid: amount };
      if (becomingPaidStatus && !m.paidDate) {
        const today = todayIso();
        payload.paid_date = today;
        finalPatch = { ...finalPatch, paidDate: today };
      }
    }

    const supabase = createClient();
    const ok = await fieldStatus.run(key, async () => {
      const { error } = await supabase.from("milestones").update(payload).eq("id", m.id);
      return { error: error?.message ?? null };
    });
    if (ok) {
      patchMilestone(m.id, finalPatch);
      router.refresh();
    }
  }

  async function markPaid(m: MilestoneRow) {
    const key = `${m.id}:pay`;
    const today = todayIso();
    const amount = m.amountPaid ?? m.amountDue ?? 0;
    const supabase = createClient();
    const ok = await fieldStatus.run(key, async () => {
      const { error } = await supabase
        .from("milestones")
        .update({ paid_date: today, amount_paid: amount, status: "Paid" })
        .eq("id", m.id);
      return { error: error?.message ?? null };
    });
    if (ok) {
      patchMilestone(m.id, { paidDate: today, amountPaid: amount, status: "Paid" });
      router.refresh();
    }
  }

  async function deleteMilestone(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("milestones").delete().eq("id", id);
    if (!error) {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    }
  }

  function addMilestone(m: MilestoneRow) {
    setMilestones((prev) => [...prev, m].sort((a, b) => a.sequenceOrder - b.sequenceOrder));
    router.refresh();
  }

  function requestToggleActive() {
    if (active && pendingBalance > 0) {
      setShowCloseModal(true);
      return;
    }
    doToggleActive();
  }

  async function doToggleActive() {
    setTogglingActive(true);
    const supabase = createClient();
    const next = !active;
    const { error } = await supabase.from("projects").update({ active: next }).eq("id", projectId);
    setTogglingActive(false);
    if (!error) {
      setActive(next);
      setShowCloseModal(false);
      router.refresh();
    }
  }

  const unpaidMilestones = milestones.filter((m) => Math.max(0, (m.amountDue ?? 0) - (m.amountPaid ?? 0)) > 0);

  return (
    <>
      <section className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`font-mono text-[10.5px] uppercase tracking-wide ${active ? "text-positive" : "text-ink/40"}`}>
          {active ? "Active" : fullyPaid ? "Closed" : "Inactive"}
        </span>
        <button
          onClick={requestToggleActive}
          disabled={togglingActive}
          className="font-mono text-[11px] uppercase text-brand-primary underline underline-offset-2 disabled:opacity-50"
        >
          {togglingActive ? "…" : active ? (fullyPaid ? "Mark Project Closed" : "Mark Project Inactive") : "Reopen Project"}
        </button>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Total Original Proposal" value={contractValue !== null ? fmtUsd(contractValue) : "—"} />
        <Stat label="Total Collected" value={fmtUsd(totalCollected)} />
        <Stat
          label="Pending Balance"
          value={fmtUsd(pendingBalance)}
          accent={pendingBalance > 0 ? "warning" : undefined}
        />
        <Stat
          label="Total Contracted Cost"
          value={!hasHoursLogged ? "—" : fmtUsd(totalCost)}
          flag={hasUnknownRate}
        />
        <Stat label="Profitability" value={fmtUsd(profitability)} accent={profitability >= 0 ? "positive" : "warning"} />
      </section>

      <CollapsibleSection title="Milestones & Payments">
        {milestones.length === 0 ? (
          <div className="mb-4 border border-line bg-surface p-4 text-sm text-ink/50">No milestones recorded.</div>
        ) : (
          <div className="mb-4 overflow-x-auto border border-line bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="px-2 py-1.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
                  <th className="px-2 py-1.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Due</th>
                  <th className="px-2 py-1.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Due $</th>
                  <th className="px-2 py-1.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid</th>
                  <th className="px-2 py-1.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid $</th>
                  <th className="px-2 py-1.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="px-2 py-1.5">{m.name}</td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end">
                        <input
                          type="date"
                          defaultValue={m.dueDate ?? ""}
                          onBlur={(e) => updateField(m, "due_date", e.target.value, { dueDate: e.target.value || null })}
                          className="w-[7.5rem] border border-line px-1 py-1 text-right text-xs"
                        />
                      </div>
                      <FieldStatusBadge status={fieldStatus.status[`${m.id}:due_date`]} error={fieldStatus.error[`${m.id}:due_date`]} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        defaultValue={m.amountDue ?? ""}
                        onBlur={(e) =>
                          updateField(m, "amount_due", e.target.value, {
                            amountDue: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-16 border border-line px-1 py-1 text-right text-xs"
                      />
                      <FieldStatusBadge status={fieldStatus.status[`${m.id}:amount_due`]} error={fieldStatus.error[`${m.id}:amount_due`]} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="date"
                        defaultValue={m.paidDate ?? ""}
                        onBlur={(e) => updateField(m, "paid_date", e.target.value, { paidDate: e.target.value || null })}
                        className="w-[7.5rem] border border-line px-1 py-1 text-right text-xs"
                      />
                      <FieldStatusBadge status={fieldStatus.status[`${m.id}:paid_date`]} error={fieldStatus.error[`${m.id}:paid_date`]} />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        defaultValue={m.amountPaid ?? ""}
                        onBlur={(e) =>
                          updateField(m, "amount_paid", e.target.value, {
                            amountPaid: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-16 border border-line px-1 py-1 text-right text-xs"
                      />
                      <FieldStatusBadge status={fieldStatus.status[`${m.id}:amount_paid`]} error={fieldStatus.error[`${m.id}:amount_paid`]} />
                    </td>
                    <td className="px-2 py-1.5 text-left">
                      <select
                        value={m.status}
                        onChange={(e) => updateField(m, "status", e.target.value, { status: e.target.value })}
                        className="w-[5.5rem] border border-line px-1 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <FieldStatusBadge status={fieldStatus.status[`${m.id}:status`]} error={fieldStatus.error[`${m.id}:status`]} />
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {m.status !== "Paid" && (
                        <button
                          onClick={() => markPaid(m)}
                          title="Mark Paid"
                          className="mr-1.5 font-mono text-[10px] text-positive underline underline-offset-2"
                        >
                          Pay
                        </button>
                      )}
                      <button
                        onClick={() => deleteMilestone(m.id)}
                        title="Delete"
                        className="font-mono text-[10px] text-warning underline underline-offset-2"
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddMilestoneForm projectId={projectId} nextSequence={milestones.length + 1} onAdded={addMilestone} />
      </CollapsibleSection>

      {showCloseModal && (
        <CloseBalanceModal
          pendingBalance={pendingBalance}
          unpaidMilestones={unpaidMilestones}
          onUpdateAmountPaid={(m, value) =>
            updateField(m, "amount_paid", value, { amountPaid: value === "" ? null : Number(value) })
          }
          fieldStatus={fieldStatus}
          closing={togglingActive}
          onCancel={() => setShowCloseModal(false)}
          onConfirmClose={doToggleActive}
        />
      )}
    </>
  );
}

function CloseBalanceModal({
  pendingBalance,
  unpaidMilestones,
  onUpdateAmountPaid,
  fieldStatus,
  closing,
  onCancel,
  onConfirmClose,
}: {
  pendingBalance: number;
  unpaidMilestones: MilestoneRow[];
  onUpdateAmountPaid: (m: MilestoneRow, value: string) => void;
  fieldStatus: ReturnType<typeof useFieldStatus>;
  closing: boolean;
  onCancel: () => void;
  onConfirmClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-lg border border-line bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-base text-ink">Still a Pending Balance</h3>
        <p className="mb-4 text-sm text-ink/70">
          This project has <span className="font-mono text-warning">{fmtUsd(pendingBalance)}</span> outstanding across{" "}
          {unpaidMilestones.length} {unpaidMilestones.length === 1 ? "payment" : "payments"}. Fix the amount below if it's
          wrong, or close the project anyway.
        </p>

        <div className="mb-4 border border-line bg-canvas">
          {unpaidMilestones.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 border-b border-line p-2 last:border-b-0">
              <div className="min-w-[120px] flex-1 text-xs text-ink">{m.name}</div>
              <div className="font-mono text-xs text-ink/50">Due {fmtUsd(m.amountDue ?? 0)}</div>
              <div className="flex items-center">
                <span className="mr-1 font-mono text-[10px] uppercase text-ink/50">Paid</span>
                <input
                  type="number"
                  defaultValue={m.amountPaid ?? ""}
                  onBlur={(e) => onUpdateAmountPaid(m, e.target.value)}
                  className="w-20 border border-line px-1.5 py-1 text-right text-xs"
                />
              </div>
              <FieldStatusBadge
                status={fieldStatus.status[`${m.id}:amount_paid`]}
                error={fieldStatus.error[`${m.id}:amount_paid`]}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onConfirmClose}
            disabled={closing}
            className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {closing ? "Closing…" : "Close Project Anyway"}
          </button>
          <button onClick={onCancel} className="font-mono text-xs uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
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
    const today = todayIso();
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
