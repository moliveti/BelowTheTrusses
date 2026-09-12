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

type BillingStatus = "Active" | "Inactive" | "Closed";
const ALL_STATUSES: BillingStatus[] = ["Active", "Inactive", "Closed"];
const ALL_TYPES = ["Residential", "Commercial", "Furniture"];

// Mirrors the Active/Inactive/Closed label logic already rendered per row,
// pulled out so the filter and the badge can never disagree.
function billingStatus(p: ProjectListItem): BillingStatus {
  if (p.active) return "Active";
  if (p.plannedRevenue !== null && p.amountPaid >= p.plannedRevenue) return "Closed";
  return "Inactive";
}

function PillToggle<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: T[];
  selected: Set<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ${
            selected.has(opt) ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function ProjectsIndex({ projects }: { projects: ProjectListItem[] }) {
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<BillingStatus>>(new Set(ALL_STATUSES));
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(ALL_TYPES));

  function toggleStatus(status: BillingStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const filtered = projects.filter(
    (p) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase())) &&
      selectedTypes.has(p.type) &&
      selectedStatuses.has(billingStatus(p))
  );

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Projects</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">All Projects &amp; Billing Status</span>
      </div>

      <input
        type="text"
        placeholder="Search projects or clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/50">Status</div>
          <PillToggle options={ALL_STATUSES} selected={selectedStatuses} onToggle={toggleStatus} />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/50">Type</div>
          <PillToggle options={ALL_TYPES} selected={selectedTypes} onToggle={toggleType} />
        </div>
      </div>
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
                      {billingStatus(p) === "Active" ? (
                        <span className="text-positive">Active</span>
                      ) : (
                        <span className="text-ink/40">{billingStatus(p)}</span>
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
