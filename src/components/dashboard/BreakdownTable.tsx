"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { ProjectType, RevenueRow } from "@/lib/dashboard/types";
import {
  PROJECT_TYPES,
  distinctYears,
  monthlyByTypeForYear,
  monthlyTotalsForYear,
  projectTotalsForYearAndType,
} from "@/lib/dashboard/aggregate";
import { MONTH_LABELS } from "@/lib/dashboard/format";

const fmt1 = (n: number) => (n ? Math.round(n).toLocaleString("en-US") : "—");
const fmtPct = (value: number, base: number) => (base > 0 && value !== 0 ? `${((value / base) * 100).toFixed(1)}%` : "—");

const TYPE_CLASS: Record<string, string> = {
  Residential: "text-[var(--positive)]",
  Commercial: "text-brand-primary",
  Furniture: "text-brand-accent",
};

type Category = ProjectType | "total";

export function BreakdownTable({ rows, onYearClick }: { rows: RevenueRow[]; onYearClick?: (year: number) => void }) {
  const years = distinctYears(rows);
  const [category, setCategory] = useState<Category>("total");
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [showPercent, setShowPercent] = useState(false);

  function toggleYear(y: number) {
    onYearClick?.(y);
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  function toggleType(key: string) {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (years.length === 0) {
    return <div className="border border-line bg-surface p-5 text-sm text-ink/50">No data yet.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
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
        <div className="flex gap-1">
          <button
            onClick={() => setShowPercent(false)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
              !showPercent ? "bg-ink text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            $
          </button>
          <button
            onClick={() => setShowPercent(true)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
              showPercent ? "bg-ink text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            %
          </button>
        </div>
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
                  const yearGrandTotal = colTotals.reduce((a, b) => a + b, 0);
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
                            {showPercent ? fmtPct(v, yearGrandTotal) : fmt1(v)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {showPercent ? "100.0%" : fmt1(yearGrandTotal)}
                        </td>
                      </tr>
                      {isOpen &&
                        PROJECT_TYPES.map((type) => {
                          const monthly = byType[type];
                          const rowTotal = monthly.reduce((a, b) => a + b, 0);
                          const typeKey = `${y}::${type}`;
                          const typeOpen = expandedTypes.has(typeKey);
                          const projectRows = typeOpen ? projectTotalsForYearAndType(rows, y, type) : [];
                          return (
                            <Fragment key={type}>
                              <tr
                                onClick={() => rowTotal > 0 && toggleType(typeKey)}
                                className={`border-b border-line hover:bg-canvas ${rowTotal > 0 ? "cursor-pointer" : ""}`}
                              >
                                <td className={`px-3 py-2.5 pl-8 text-left font-mono text-[11px] ${TYPE_CLASS[type]}`}>
                                  {rowTotal > 0 && (
                                    <span className="mr-1.5 inline-block w-3 text-[10px] text-ink/40">
                                      {typeOpen ? "▼" : "▶"}
                                    </span>
                                  )}
                                  {type}
                                </td>
                                {monthly.map((v, i) => (
                                  <td key={i} className="px-3 py-2.5 text-right tabular-nums">
                                    {showPercent ? fmtPct(v, colTotals[i]) : fmt1(v)}
                                  </td>
                                ))}
                                <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                                  {showPercent ? fmtPct(rowTotal, yearGrandTotal) : fmt1(rowTotal)}
                                </td>
                              </tr>
                              {typeOpen &&
                                projectRows.map((p) => (
                                  <tr key={p.projectId} className="border-b border-line bg-canvas/40 hover:bg-canvas">
                                    <td className="px-3 py-2 pl-14 text-left text-[12px]">
                                      <Link
                                        href={`/projects/${p.projectId}`}
                                        className="text-ink/70 underline decoration-line underline-offset-2 hover:text-brand-primary"
                                      >
                                        {p.projectName}
                                      </Link>
                                    </td>
                                    {p.monthly.map((v, i) => (
                                      <td key={i} className="px-3 py-2 text-right text-[12px] tabular-nums text-ink/70">
                                        {fmt1(v)}
                                      </td>
                                    ))}
                                    <td className="px-3 py-2 text-right text-[12px] tabular-nums text-ink/70">
                                      {fmt1(p.total)}
                                    </td>
                                  </tr>
                                ))}
                            </Fragment>
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
                          {showPercent ? fmtPct(v, total) : fmt1(v)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {showPercent ? "100.0%" : fmt1(total)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
