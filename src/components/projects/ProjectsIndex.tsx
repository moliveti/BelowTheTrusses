"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectListItem } from "@/lib/projects/types";
import { fmtUsd } from "@/lib/dashboard/format";

const TYPE_CLASS: Record<string, string> = {
  Residential: "text-[var(--positive)]",
  Commercial: "text-brand-primary",
  Furniture: "text-brand-accent",
};

export function ProjectsIndex({ projects }: { projects: ProjectListItem[] }) {
  const [search, setSearch] = useState("");
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search projects or clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Project / Client
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Type / Active
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Hours / Cost per hr
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Planned Rev. / Paid
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Total Cost / Outstanding
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const costPerHour = p.hours > 0 ? p.totalCost / p.hours : null;
              return (
                <tr key={p.id} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2.5 text-left">
                    <div>
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-brand-primary underline decoration-brand-primary/30 underline-offset-2 hover:decoration-brand-primary"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <div className="text-xs text-ink/60">{p.clientName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-left">
                    <div className={`font-mono text-[11px] ${TYPE_CLASS[p.type] ?? ""}`}>{p.type}</div>
                    <div className="font-mono text-[10px] uppercase">
                      {p.active ? (
                        <span className="text-positive">Active</span>
                      ) : (
                        <span className="text-ink/40">
                          {p.plannedRevenue !== null && p.amountPaid >= p.plannedRevenue ? "Closed" : "Inactive"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono tabular-nums">{p.hours ? p.hours.toFixed(2) : "—"}</div>
                    <div className="font-mono text-xs tabular-nums text-ink/60">
                      {costPerHour !== null ? fmtUsd(costPerHour) : "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono tabular-nums">
                      {p.plannedRevenue !== null ? fmtUsd(p.plannedRevenue) : "—"}
                    </div>
                    <div className="font-mono text-xs tabular-nums text-ink/60">
                      {p.amountPaid ? fmtUsd(p.amountPaid) : "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono tabular-nums">
                      {p.hours ? fmtUsd(p.totalCost) : "—"}
                      {p.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                    </div>
                    <div className="font-mono text-xs tabular-nums text-ink/60">
                      {p.outstandingBalance ? fmtUsd(p.outstandingBalance) : "—"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-ink/40">* some hours have no rate set on their assignment — cost is understated.</p>
    </div>
  );
}
