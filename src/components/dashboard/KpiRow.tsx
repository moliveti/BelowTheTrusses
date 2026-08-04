"use client";

import type { RevenueRow } from "@/lib/dashboard/types";
import { distinctYears, yearTotal, yoyDeltaPct } from "@/lib/dashboard/aggregate";
import { fmtUsd } from "@/lib/dashboard/format";

export function KpiRow({
  rows,
  currentYear,
  extra,
}: {
  rows: RevenueRow[];
  currentYear: number;
  extra?: React.ReactNode;
}) {
  const years = distinctYears(rows);
  const shownYears = years.filter((y) => y <= currentYear).slice(-3);

  const referralTotal = rows.filter((r) => r.referralSourceId).reduce((s, r) => s + r.amount, 0);

  const cards = shownYears.map((year, i) => {
    const total = yearTotal(rows, year);
    const prior = i > 0 ? yearTotal(rows, shownYears[i - 1]) : null;
    const delta = prior !== null ? yoyDeltaPct(total, prior) : null;
    const isCurrent = year === currentYear;
    return {
      label: `FY${year} ${isCurrent ? "(YTD)" : "Actual"}`,
      value: fmtUsd(total),
      delta,
      isCurrent,
    };
  });

  cards.push({ label: "Referral-Sourced (lifetime)", value: fmtUsd(referralTotal), delta: null, isCurrent: false });

  return (
    <div className={`grid grid-cols-2 gap-4 ${extra ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
      {cards.map((k) => (
        <div
          key={k.label}
          className={`border-t-2 border-t-brand-accent p-5 ${
            k.isCurrent ? "border border-brand-accent/40 bg-brand-accent/5" : "border border-line bg-surface"
          }`}
        >
          <div className="mb-2 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{k.label}</div>
          <div className="font-mono text-xl tabular-nums text-ink">{k.value}</div>
          {k.delta !== null && (
            <div className={`mt-1.5 font-mono text-xs ${k.delta >= 0 ? "text-positive" : "text-warning"}`}>
              {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta).toFixed(0)}% vs prior year
            </div>
          )}
        </div>
      ))}
      {extra}
    </div>
  );
}
