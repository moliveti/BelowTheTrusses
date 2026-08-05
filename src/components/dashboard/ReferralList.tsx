"use client";

import { useState } from "react";
import type { RevenueRow, ReferralSource } from "@/lib/dashboard/types";
import { referralTotals } from "@/lib/dashboard/aggregate";
import { fmtUsd } from "@/lib/dashboard/format";

export function ReferralList({
  collectedRows,
  forecastRows,
  referralSources,
}: {
  collectedRows: RevenueRow[];
  forecastRows: RevenueRow[];
  referralSources: ReferralSource[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const collectedTotals = referralTotals(collectedRows, referralSources);
  const forecastTotals = referralTotals(forecastRows, referralSources);
  const forecastById = new Map(forecastTotals.map((f) => [f.id, f.total]));

  const totals = collectedTotals
    .map((r) => ({ ...r, forecast: forecastById.get(r.id) ?? 0 }))
    .sort((a, b) => b.total + b.forecast - (a.total + a.forecast));
  const maxTotal = totals.length ? totals[0].total + totals[0].forecast : 1;

  if (totals.length === 0) {
    return <div className="text-sm text-ink/50">No referral-sourced revenue yet.</div>;
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {totals.map((r) => {
        const years = Object.keys(r.byYear).map(Number).sort((a, b) => a - b);
        const isOpen = expanded.has(r.id);
        const grandTotal = r.total + r.forecast;
        return (
          <div key={r.id} className="border-b border-line py-1.5">
            <button
              onClick={() => toggle(r.id)}
              className="flex w-full items-center gap-2.5 text-left text-[13px]"
            >
              <div className="w-[150px] flex-shrink-0 truncate">{r.name}</div>
              <div className="relative flex h-3.5 flex-1 border border-line bg-canvas">
                <div className="h-full bg-brand-accent" style={{ width: `${Math.round((r.total / maxTotal) * 100)}%` }} />
                {r.forecast > 0 && (
                  <div className="h-full bg-brand-accent/35" style={{ width: `${Math.round((r.forecast / maxTotal) * 100)}%` }} />
                )}
              </div>
              <div className="w-20 flex-shrink-0 text-right font-mono text-[11.5px] tabular-nums text-ink/60">
                {fmtUsd(grandTotal)}
              </div>
            </button>
            {isOpen && (
              <div className="ml-[10px] mt-2 mb-1 flex flex-wrap gap-x-4 gap-y-1 border-l-2 border-line pl-3 font-mono text-[11px] text-ink/60">
                {years.map((y) => (
                  <span key={y}>
                    {y}: <span className="tabular-nums text-ink">{fmtUsd(r.byYear[y])}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
