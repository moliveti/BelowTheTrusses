"use client";

import { useState } from "react";
import type { RevenueRow } from "@/lib/dashboard/types";
import { PROJECT_TYPES, distinctYears, monthlyByTypeForYear, monthlyTotalsForYear } from "@/lib/dashboard/aggregate";
import { MONTH_LABELS } from "@/lib/dashboard/format";

const fmt1 = (n: number) => (n ? Math.round(n).toLocaleString("en-US") : "—");

const TYPE_CLASS: Record<string, string> = {
  Residential: "text-[var(--positive)]",
  Commercial: "text-brand-primary",
  Furniture: "text-brand-accent",
};

export function BreakdownTable({ rows }: { rows: RevenueRow[] }) {
  const years = distinctYears(rows);
  const [compare, setCompare] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(years[years.length - 1] ?? null);

  if (years.length === 0) {
    return <div className="border border-line bg-surface p-5 text-sm text-ink/50">No data yet.</div>;
  }

  const activeYear = selectedYear ?? years[years.length - 1];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          {!compare &&
            years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wide ${
                  y === activeYear
                    ? "bg-brand-primary text-white"
                    : "border border-ink text-ink hover:bg-canvas"
                }`}
              >
                {y}
              </button>
            ))}
        </div>
        <button
          onClick={() => setCompare((c) => !c)}
          className="font-mono text-xs uppercase tracking-wide text-ink/60 underline underline-offset-2"
        >
          {compare ? "Back to single year" : "Compare years"}
        </button>
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        {compare ? (
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                  Year
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const monthly = monthlyTotalsForYear(rows, y);
                const total = monthly.reduce((a, b) => a + b, 0);
                return (
                  <tr key={y} className="border-b border-line hover:bg-canvas">
                    <td className="px-3 py-2.5 text-left">{y}</td>
                    {monthly.map((v, i) => (
                      <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                        {fmt1(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt1(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                  Type
                </th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const byType = monthlyByTypeForYear(rows, activeYear);
                const colTotals = new Array(12).fill(0);
                const typeRows = PROJECT_TYPES.map((type) => {
                  const monthly = byType[type];
                  monthly.forEach((v, i) => (colTotals[i] += v));
                  const rowTotal = monthly.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={type} className="border-b border-line hover:bg-canvas">
                      <td className={`px-3 py-2.5 text-left font-mono text-[11px] ${TYPE_CLASS[type]}`}>{type}</td>
                      {monthly.map((v, i) => (
                        <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                          {fmt1(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt1(rowTotal)}</td>
                    </tr>
                  );
                });
                const grand = colTotals.reduce((a, b) => a + b, 0);
                return (
                  <>
                    {typeRows}
                    <tr className="border-t-[1.5px] border-ink font-bold">
                      <td className="px-3 py-2.5 text-left">Total</td>
                      {colTotals.map((v, i) => (
                        <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                          {fmt1(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt1(grand)}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
