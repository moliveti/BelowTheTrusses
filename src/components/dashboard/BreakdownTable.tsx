"use client";

import { Fragment, useState } from "react";
import type { ProjectType, RevenueRow } from "@/lib/dashboard/types";
import { PROJECT_TYPES, distinctYears, monthlyByTypeForYear, monthlyTotalsForYear } from "@/lib/dashboard/aggregate";
import { MONTH_LABELS } from "@/lib/dashboard/format";

const fmt1 = (n: number) => (n ? Math.round(n).toLocaleString("en-US") : "—");

const TYPE_CLASS: Record<string, string> = {
  Residential: "text-[var(--positive)]",
  Commercial: "text-brand-primary",
  Furniture: "text-brand-accent",
};

type Category = ProjectType | "total";

export function BreakdownTable({ rows }: { rows: RevenueRow[] }) {
  const years = distinctYears(rows);
  const [category, setCategory] = useState<Category>("total");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  function toggleYear(y: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  if (years.length === 0) {
    return <div className="border border-line bg-surface p-5 text-sm text-ink/50">No data yet.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1">
        {PROJECT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setCategory(t)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wide ${
              category === t ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setCategory("total")}
          className={`px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide ${
            category === "total" ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
          }`}
        >
          Total by Category
        </button>
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                {category === "total" ? "Year / Type" : "Year"}
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
            {category === "total"
              ? years.map((y) => {
                  const byType = monthlyByTypeForYear(rows, y);
                  const colTotals = monthlyTotalsForYear(rows, y);
                  const isOpen = expandedYears.has(y);
                  return (
                    <Fragment key={y}>
                      <tr
                        onClick={() => toggleYear(y)}
                        className="cursor-pointer border-b-[1.5px] border-ink font-bold hover:bg-canvas"
                      >
                        <td className="px-3 py-2.5 text-left">
                          <span className="mr-1.5 inline-block w-3 font-mono text-[10px] text-ink/50">
                            {isOpen ? "▼" : "▶"}
                          </span>
                          {y}
                        </td>
                        {colTotals.map((v, i) => (
                          <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                            {fmt1(v)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {fmt1(colTotals.reduce((a, b) => a + b, 0))}
                        </td>
                      </tr>
                      {isOpen &&
                        PROJECT_TYPES.map((type) => {
                          const monthly = byType[type];
                          const rowTotal = monthly.reduce((a, b) => a + b, 0);
                          return (
                            <tr key={type} className="border-b border-line hover:bg-canvas">
                              <td className={`px-3 py-2.5 pl-8 text-left font-mono text-[11px] ${TYPE_CLASS[type]}`}>
                                {type}
                              </td>
                              {monthly.map((v, i) => (
                                <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                                  {fmt1(v)}
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt1(rowTotal)}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              : years.map((y) => {
                  const monthly = monthlyTotalsForYear(
                    rows.filter((r) => r.type === category),
                    y
                  );
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
      </div>
    </div>
  );
}
