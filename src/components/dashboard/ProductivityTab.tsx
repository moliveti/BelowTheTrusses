"use client";

import { Fragment, useMemo, useState } from "react";
import type { TimeEntry } from "@/lib/hours/types";
import {
  costByContractor,
  costByMonth,
  costByProject,
  distinctYearsFromEntries,
  personBreakdownForYear,
  sumMonthly,
  type CostBreakdownRow,
} from "@/lib/hours/productivity";
import { fmtUsd, MONTH_LABELS } from "@/lib/dashboard/format";

const fmtHours = (n: number) => (n ? n.toFixed(2) : "—");
const fmtCost = (n: number) => (n ? fmtUsd(n) : "—");
const fmtRate = (n: number | null) => (n === null ? "—" : `${fmtUsd(n)}/hr`);

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
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Cost Per Hour</h3>
            <CostPerHourDashboard entries={entries} />
          </section>

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

type CostView = "project" | "contractor" | "month";

function CostPerHourDashboard({ entries }: { entries: TimeEntry[] }) {
  const [view, setView] = useState<CostView>("project");

  const byProject = useMemo(() => costByProject(entries), [entries]);
  const byContractor = useMemo(() => costByContractor(entries), [entries]);
  const byMonth = useMemo(() => costByMonth(entries), [entries]);

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalCost = entries.reduce((s, e) => s + (e.hourlyRate !== null ? e.hours * e.hourlyRate : 0), 0);
  const blendedRate = totalHours > 0 ? totalCost / totalHours : null;
  const hasUnknownRate = entries.some((e) => e.hourlyRate === null);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Hours" value={fmtHours(totalHours)} />
        <Stat label="Total Cost" value={fmtCost(totalCost)} flag={hasUnknownRate} />
        <Stat label="Blended $/hr" value={fmtRate(blendedRate)} />
        <Stat label="Projects Staffed" value={String(byProject.length)} />
      </div>

      <div className="mb-3 flex gap-1">
        {(["project", "contractor", "month"] as CostView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide ${
              view === v ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            By {v === "project" ? "Project" : v === "contractor" ? "Contractor" : "Month"}
          </button>
        ))}
      </div>

      {view === "project" && <CostBreakdownTable rows={byProject} nameHeader="Project" />}
      {view === "contractor" && <CostBreakdownTable rows={byContractor} nameHeader="Contractor" />}
      {view === "month" && <MonthCostTable rows={byMonth} />}
    </div>
  );
}

function CostBreakdownTable({ rows, nameHeader }: { rows: CostBreakdownRow[]; nameHeader: string }) {
  if (rows.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No data yet.</div>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{nameHeader}</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Avg $/hr</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line hover:bg-canvas">
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(r.hours)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtCost(r.cost)}
                {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtRate(r.avgRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink/40">
        * some hours have no rate set on their assignment — cost is understated.
      </p>
    </div>
  );
}

function MonthCostTable({ rows }: { rows: ReturnType<typeof costByMonth> }) {
  if (rows.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No data yet.</div>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Month</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Avg $/hr</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.year}-${r.month}`} className="border-b border-line hover:bg-canvas">
              <td className="px-3 py-2">
                {MONTH_LABELS[r.month - 1]} {r.year}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(r.hours)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtCost(r.cost)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtRate(r.avgRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{label}</div>
      <div className="font-mono text-lg tabular-nums text-ink">
        {value}
        {flag && <span className="ml-1 text-warning">*</span>}
      </div>
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
