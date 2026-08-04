"use client";

import { Fragment, useState } from "react";
import type { TimeEntry } from "@/lib/hours/types";
import { distinctYearsFromEntries, personBreakdownForYear, sumMonthly } from "@/lib/hours/productivity";
import { fmtUsd, MONTH_LABELS } from "@/lib/dashboard/format";

const fmtHours = (n: number) => (n ? n.toFixed(2) : "—");
const fmtCost = (n: number) => (n ? fmtUsd(n) : "—");

export function ProductivityTab({ entries }: { entries: TimeEntry[] }) {
  const years = distinctYearsFromEntries(entries);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Productivity</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours &amp; Cost by Month</span>
      </div>

      {years.length === 0 ? (
        <div className="border border-line bg-surface p-5 text-sm text-ink/50">No hours logged yet.</div>
      ) : (
        <>
          <section className="mb-12">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Hours Worked</h3>
            <PersonYearTable years={years} entries={entries} metric="hours" />
          </section>

          <section>
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Amount Paid to Contractors &amp; Amy</h3>
            <PersonYearTable years={years} entries={entries} metric="cost" />
          </section>
        </>
      )}
    </div>
  );
}

function PersonYearTable({
  years,
  entries,
  metric,
}: {
  years: number[];
  entries: TimeEntry[];
  metric: "hours" | "cost";
}) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const key = metric === "hours" ? "hoursMonthly" : "costMonthly";
  const fmt = metric === "hours" ? fmtHours : fmtCost;

  function toggleYear(y: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
              Year / Person
            </th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
                {m}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Total</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const people = personBreakdownForYear(entries, y);
            const colTotals = sumMonthly(people, key);
            const isOpen = expandedYears.has(y);
            const hasUnknownRate = metric === "cost" && people.some((p) => p.hasUnknownRate);
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
                      {fmt(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmt(colTotals.reduce((a, b) => a + b, 0))}
                    {hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                  </td>
                </tr>
                {isOpen &&
                  people.map((p) => {
                    const monthly = p[key];
                    const rowTotal = monthly.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={p.personId} className="border-b border-line hover:bg-canvas">
                        <td className="px-3 py-2.5 pl-8 text-left text-[12px] text-ink/70">{p.personName}</td>
                        {monthly.map((v, i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-[12px] tabular-nums text-ink/70">
                            {fmt(v)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums text-ink/70">
                          {fmt(rowTotal)}
                          {metric === "cost" && p.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
