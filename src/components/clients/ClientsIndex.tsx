"use client";

import { useState } from "react";
import Link from "next/link";
import type { ClientListItem } from "@/lib/clients/types";
import { fmtUsd } from "@/lib/dashboard/format";

export function ClientsIndex({ clients }: { clients: ClientListItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Clients</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
          All Clients &amp; Their Projects
        </span>
      </div>

      <input
        type="text"
        placeholder="Search clients…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full max-w-sm border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
      />

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Client
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Projects / Types
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Planned Rev.
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Paid
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                Outstanding
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-line hover:bg-canvas">
                <td className="px-3 py-2.5 text-left">
                  <Link
                    href={`/clients/${c.id}`}
                    className="text-brand-primary underline decoration-brand-primary/30 underline-offset-2 hover:decoration-brand-primary"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-left">
                  <div className="font-mono tabular-nums">
                    {c.projectCount} {c.projectCount === 1 ? "project" : "projects"}
                    {c.activeProjectCount > 0 && <span className="text-ink/50"> ({c.activeProjectCount} active)</span>}
                  </div>
                  <div className="text-xs text-ink/60">{c.types.join(", ") || "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="font-mono tabular-nums">{c.totalPlannedRevenue ? fmtUsd(c.totalPlannedRevenue) : "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="font-mono tabular-nums">{c.totalPaid ? fmtUsd(c.totalPaid) : "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="font-mono tabular-nums">{c.totalOutstanding ? fmtUsd(c.totalOutstanding) : "—"}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
