"use client";

import { useMemo, useState } from "react";
import type { ProjectHourRow } from "@/lib/projects/types";
import { fmtUsd } from "@/lib/dashboard/format";

type StatusFilter = "all" | "pending" | "paid";

export function HoursCostSection({ hoursByPerson }: { hoursByPerson: ProjectHourRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const visible = useMemo(() => {
    if (statusFilter === "all") return hoursByPerson;
    return hoursByPerson.filter((h) => (statusFilter === "paid" ? h.paidHours > 0 : h.pendingHours > 0));
  }, [hoursByPerson, statusFilter]);

  const totals = visible.reduce(
    (acc, h) => {
      acc.hours += h.hours;
      acc.cost += h.cost ?? 0;
      acc.paidCost += h.paidCost;
      acc.pendingCost += h.pendingCost;
      return acc;
    },
    { hours: 0, cost: 0, paidCost: 0, pendingCost: 0 }
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-ink pb-2">
        <h3 className="font-mono text-xs uppercase tracking-wide text-ink/60">Hours &amp; Cost</h3>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-line px-2 py-1 text-xs"
        >
          <option value="all">All billing status</option>
          <option value="pending">Has pending</option>
          <option value="paid">Has paid</option>
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="border border-line bg-surface p-4 text-sm text-ink/50">No hours match the current filter.</div>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Allocated</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Rate</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid $</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Pending $</th>
                <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <tr key={h.subcontractorId} className="border-b border-line">
                  <td className="px-3 py-2">{h.subcontractorName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{h.hours.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{h.allocatedHours !== null ? h.allocatedHours.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{h.rate !== null ? fmtUsd(h.rate) + "/hr" : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-positive">{fmtUsd(h.paidCost)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(h.pendingCost)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{h.cost !== null ? fmtUsd(h.cost) : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-[1.5px] border-ink font-bold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{totals.hours.toFixed(2)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(totals.paidCost)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(totals.pendingCost)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(totals.cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
