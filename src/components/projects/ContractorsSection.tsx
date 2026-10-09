"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFieldStatus } from "@/hooks/useFieldStatus";
import { FieldStatusBadge } from "@/components/FieldStatusBadge";
import { effectiveRate } from "@/lib/hours/rates";
import type { Assignment, SubcontractorRates } from "@/lib/hours/types";

const inputClass = "w-24 border border-line px-2 py-1 text-right text-xs outline-none focus:border-brand-primary";

/**
 * Who works on this project, with the hours committed to each and the rate they
 * are paid. The same project_subcontractors rows the Timesheets tab edits from
 * the contractor's side; this is the project's side. Cost and profitability
 * reporting read the rate from here, and a contractor can only log time on a
 * project they're assigned to.
 */
export function ContractorsSection({
  projectId,
  projectType,
  initialAssignments,
  contractors,
}: {
  projectId: string;
  projectType: string;
  initialAssignments: Assignment[];
  contractors: SubcontractorRates[];
}) {
  const router = useRouter();
  const { status, error, run, failed } = useFieldStatus();
  const [rows, setRows] = useState(initialAssignments);
  const [toAdd, setToAdd] = useState("");

  const nameOf = (id: string) => contractors.find((c) => c.id === id)?.name ?? "Unknown contractor";
  const available = contractors.filter((c) => !rows.some((r) => r.subcontractorId === c.id));

  async function add() {
    if (!toAdd) return;
    const subcontractorId = toAdd;
    const rate = effectiveRate(contractors.find((c) => c.id === subcontractorId), projectType);
    const ok = await run("add", async () => {
      const { error: insertError } = await createClient()
        .from("project_subcontractors")
        .insert({ project_id: projectId, subcontractor_id: subcontractorId, hourly_rate: rate });
      return { error: insertError?.message ?? null };
    });
    if (ok) {
      setRows((prev) => [...prev, { projectId, subcontractorId, hourlyRate: rate, allocatedHours: null }]);
      setToAdd("");
      router.refresh();
    }
  }

  async function save(subcontractorId: string, field: "allocatedHours" | "hourlyRate", value: string) {
    const key = `${subcontractorId}:${field}`;
    const current = rows.find((r) => r.subcontractorId === subcontractorId);
    const num = value.trim() === "" ? null : Number(value);
    if (num === (current?.[field] ?? null)) return;
    if (num !== null && (!Number.isFinite(num) || num < 0 || (field === "allocatedHours" && num === 0))) {
      return failed(key, field === "allocatedHours" ? "Hours must be more than zero" : "Rate must be zero or more");
    }
    const ok = await run(key, async () => {
      const { error: updateError } = await createClient()
        .from("project_subcontractors")
        .update({ [field === "hourlyRate" ? "hourly_rate" : "allocated_hours"]: num })
        .eq("project_id", projectId)
        .eq("subcontractor_id", subcontractorId);
      return { error: updateError?.message ?? null };
    });
    if (ok) {
      setRows((prev) => prev.map((r) => (r.subcontractorId === subcontractorId ? { ...r, [field]: num } : r)));
      router.refresh();
    }
  }

  async function remove(subcontractorId: string) {
    const ok = await run(`${subcontractorId}:remove`, async () => {
      const { error: deleteError } = await createClient()
        .from("project_subcontractors")
        .delete()
        .eq("project_id", projectId)
        .eq("subcontractor_id", subcontractorId);
      return { error: deleteError?.message ?? null };
    });
    if (ok) {
      setRows((prev) => prev.filter((r) => r.subcontractorId !== subcontractorId));
      router.refresh();
    }
  }

  return (
    <div className="border border-line bg-surface">
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-ink/50">
          No contractors assigned yet. A contractor can only log time on a project that is assigned to them.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Contractor</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Allocated Hrs</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Rate $/hr</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subcontractorId} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2">{nameOf(r.subcontractorId)}</td>
                  {(["allocatedHours", "hourlyRate"] as const).map((field) => (
                    <td key={field} className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step={field === "allocatedHours" ? "0.25" : "0.01"}
                        defaultValue={r[field] ?? ""}
                        placeholder="—"
                        onBlur={(e) => save(r.subcontractorId, field, e.target.value)}
                        className={inputClass}
                      />
                      <FieldStatusBadge
                        status={status[`${r.subcontractorId}:${field}`]}
                        error={error[`${r.subcontractorId}:${field}`]}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => remove(r.subcontractorId)}
                      className="font-mono text-[11px] text-warning underline underline-offset-2"
                    >
                      Remove
                    </button>
                    <FieldStatusBadge status={status[`${r.subcontractorId}:remove`]} error={error[`${r.subcontractorId}:remove`]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
          className="min-w-[180px] border border-line px-2 py-1 text-xs"
        >
          <option value="">Add a contractor…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!toAdd || status.add === "saving"}
          className="bg-brand-primary px-3 py-1 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90 disabled:opacity-50"
        >
          Add
        </button>
        <FieldStatusBadge status={status.add} error={error.add} />
        <span className="text-[11px] text-ink/40">Their {projectType} rate is filled in automatically; change it here if this project differs.</span>
      </div>
    </div>
  );
}
