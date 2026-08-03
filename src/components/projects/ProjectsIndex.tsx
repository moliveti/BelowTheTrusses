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
        <table className="w-full min-w-[1100px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Client</th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Type</th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Active</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost/hr</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Total Cost</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Planned Revenue</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Amount Paid</th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const costPerHour = p.hours > 0 ? p.totalCost / p.hours : null;
              return (
                <tr key={p.id} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2.5 text-left">
                    <Link href={`/projects/${p.id}`} className="underline decoration-line underline-offset-2 hover:text-brand-primary">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-left text-ink/70">{p.clientName}</td>
                  <td className={`px-3 py-2.5 text-left font-mono text-[11px] ${TYPE_CLASS[p.type] ?? ""}`}>{p.type}</td>
                  <td className="px-3 py-2.5 text-left">
                    {p.active ? (
                      <span className="font-mono text-[10px] uppercase text-positive">Active</span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase text-ink/40">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{p.hours ? p.hours.toFixed(2) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {costPerHour !== null ? fmtUsd(costPerHour) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {p.hours ? fmtUsd(p.totalCost) : "—"}
                    {p.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {p.plannedRevenue !== null ? fmtUsd(p.plannedRevenue) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {p.amountPaid ? fmtUsd(p.amountPaid) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {p.outstandingBalance ? fmtUsd(p.outstandingBalance) : "—"}
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
