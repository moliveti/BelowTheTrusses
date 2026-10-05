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
import type { ProjectListItem } from "@/lib/projects/types";
import type { PaymentRow } from "@/lib/payments/types";
import {
  buildProjectProfitRows,
  profitYears,
  totalProfitRows,
  type ProfitYear,
  type ProjectProfitRow,
} from "@/lib/projects/profitability";

const fmtHours = (n: number) => (n ? n.toFixed(2) : "—");
const fmtCost = (n: number) => (n ? fmtUsd(n) : "—");
const fmtRate = (n: number | null) => (n === null ? "—" : `${fmtUsd(n)}/hr`);

export function ProductivityTab({
  entries,
  projects,
  payments,
}: {
  entries: TimeEntry[];
  projects: ProjectListItem[];
  payments: PaymentRow[];
}) {
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
            <CostPerHourDashboard entries={entries} projects={projects} payments={payments} />
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

function CostPerHourDashboard({
  entries,
  projects,
  payments,
}: {
  entries: TimeEntry[];
  projects: ProjectListItem[];
  payments: PaymentRow[];
}) {
  const [view, setView] = useState<CostView>("project");
  const [year, setYear] = useState<ProfitYear>("all");

  // The tiles above always show all-time and year-to-date; the year picker scopes the three tables below.
  const yearEntries = useMemo(
    () => (year === "all" ? entries : entries.filter((e) => e.workDate.slice(0, 4) === String(year))),
    [entries, year]
  );
  const yearOptions = useMemo(() => profitYears(entries, payments, new Date().getFullYear()), [entries, payments]);

  const byProject = useMemo(() => costByProject(entries), [entries]);
  const profitRows = useMemo(() => buildProjectProfitRows(entries, projects, payments, year), [entries, projects, payments, year]);
  const byContractor = useMemo(() => costByContractor(yearEntries), [yearEntries]);
  const byMonth = useMemo(() => costByMonth(yearEntries), [yearEntries]);

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalCost = entries.reduce((s, e) => s + (e.hourlyRate !== null ? e.hours * e.hourlyRate : 0), 0);
  const blendedRate = totalHours > 0 ? totalCost / totalHours : null;
  const hasUnknownRate = entries.some((e) => e.hourlyRate === null);

  const currentYear = new Date().getFullYear();
  const ytdEntries = useMemo(() => entries.filter((e) => e.workDate.slice(0, 4) === String(currentYear)), [entries, currentYear]);
  const paidHours = (rows: TimeEntry[]) => rows.filter((e) => e.paidAt !== null).reduce((s, e) => s + e.hours, 0);
  const unpaidHours = (rows: TimeEntry[]) => rows.filter((e) => e.paidAt === null).reduce((s, e) => s + e.hours, 0);
  const allTimePaid = paidHours(entries);
  const allTimeUnpaid = unpaidHours(entries);
  const ytdPaid = paidHours(ytdEntries);
  const ytdUnpaid = unpaidHours(ytdEntries);
  const ytdTotal = ytdPaid + ytdUnpaid;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TotalHoursStat
          allTime={totalHours}
          allTimePaid={allTimePaid}
          allTimeUnpaid={allTimeUnpaid}
          ytd={ytdTotal}
          ytdPaid={ytdPaid}
          ytdUnpaid={ytdUnpaid}
          ytdYear={currentYear}
        />
        <Stat label="Total Cost" value={fmtCost(totalCost)} flag={hasUnknownRate} />
        <Stat label="Blended $/hr" value={fmtRate(blendedRate)} />
        <Stat label="Projects Staffed" value={String(byProject.length)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
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
        <label className="ml-auto flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
          Year
          <select
            value={String(year)}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border border-line bg-surface px-2 py-1.5 text-xs normal-case text-ink"
          >
            <option value="all">Total (all years)</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {view === "project" && <ProjectProfitTable rows={profitRows} year={year} />}
      {view === "contractor" && <CostBreakdownTable rows={byContractor} nameHeader="Contractor" />}
      {view === "month" && <MonthCostTable rows={byMonth} />}
    </div>
  );
}

const fmtMoney = (n: number) => (n ? fmtUsd(n) : "—");
const fmtProfit = (n: number) => (n < 0 ? "-" : "") + fmtUsd(Math.abs(n));

function ProjectProfitTable({ rows, year }: { rows: ProjectProfitRow[]; year: ProfitYear }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  if (rows.length === 0) {
    return (
      <div className="border border-line bg-surface p-4 text-sm text-ink/50">
        {year === "all" ? "No data yet." : `No hours worked or payments due in ${year}.`}
      </div>
    );
  }

  const totals = totalProfitRows(rows);
  const anyUnknownRate = rows.some((r) => r.hasUnknownRate);
  const profitClass = (n: number) => (n < 0 ? "text-warning" : "text-positive");
  const th = "px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50";

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
            <th className={th}>Contract Value</th>
            <th className={th}>Collected</th>
            <th className={th}>Not Yet Paid</th>
            <th className={th}>Total Revenue</th>
            <th className={th}>Hours</th>
            <th className={th}>Cost</th>
            <th className={th}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = openIds.has(r.projectId);
            return (
              <Fragment key={r.projectId}>
                <tr onClick={() => toggle(r.projectId)} className="cursor-pointer border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2">
                    <span className="mr-1.5 inline-block w-3 font-mono text-[10px] text-ink/40">{isOpen ? "▼" : "▶"}</span>
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.contractValue !== null ? fmtUsd(r.contractValue) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-positive">{fmtMoney(r.collected)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.notYetPaid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtHours(r.hours)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtCost(r.cost)}
                    {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium tabular-nums ${profitClass(r.profit)}`}>{fmtProfit(r.profit)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-line bg-canvas">
                    <td colSpan={8} className="px-3 py-2 pl-8">
                      <table className="w-full max-w-xl border-collapse text-[12px]">
                        <thead>
                          <tr className="border-b border-line">
                            <th className="py-1.5 text-left font-mono text-[10px] uppercase tracking-wide text-ink/50">Contractor</th>
                            <th className="py-1.5 text-right font-mono text-[10px] uppercase tracking-wide text-ink/50">Hours</th>
                            <th className="py-1.5 text-right font-mono text-[10px] uppercase tracking-wide text-ink/50">Cost</th>
                            <th className="py-1.5 text-right font-mono text-[10px] uppercase tracking-wide text-ink/50">Avg $/hr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.contractors.map((c) => (
                            <tr key={c.id} className="border-b border-line/60 last:border-b-0">
                              <td className="py-1.5">{c.name}</td>
                              <td className="py-1.5 text-right tabular-nums">{fmtHours(c.hours)}</td>
                              <td className="py-1.5 text-right tabular-nums">
                                {fmtCost(c.cost)}
                                {c.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">{fmtRate(c.avgRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          <tr className="border-t-[1.5px] border-ink font-bold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.collected)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.notYetPaid)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totals.total)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtHours(totals.hours)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtCost(totals.cost)}</td>
            <td className={`px-3 py-2 text-right tabular-nums ${profitClass(totals.profit)}`}>{fmtProfit(totals.profit)}</td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-ink/40">
        {year === "all"
          ? "Total Revenue = collected + not yet paid, from each project's payment schedule (the contract value is used when there's no schedule yet). "
          : `Showing ${year}: revenue is the payments due in ${year}, and hours and cost are the work done in ${year}. Contract Value is the project's overall figure. `}
        Profit = Total Revenue − contractor cost. Click a project to see each contractor&apos;s hours and cost.
        {anyUnknownRate && " * some hours have no rate set on their assignment — cost is understated and profit overstated."}
      </p>
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

function TotalHoursStat({
  allTime,
  allTimePaid,
  allTimeUnpaid,
  ytd,
  ytdPaid,
  ytdUnpaid,
  ytdYear,
}: {
  allTime: number;
  allTimePaid: number;
  allTimeUnpaid: number;
  ytd: number;
  ytdPaid: number;
  ytdUnpaid: number;
  ytdYear: number;
}) {
  return (
    <div className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
      <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Total Hours</div>

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">All Time</span>
        <span className="font-mono text-lg tabular-nums text-ink">{fmtHours(allTime)}</span>
      </div>
      <div className="font-mono text-[10.5px] text-ink/50">
        {fmtHours(allTimePaid)} paid · {fmtHours(allTimeUnpaid)} unpaid
      </div>

      <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">YTD ({ytdYear})</span>
        <span className="font-mono text-lg tabular-nums text-ink">{fmtHours(ytd)}</span>
      </div>
      <div className="font-mono text-[10.5px] text-ink/50">
        {fmtHours(ytdPaid)} paid · {fmtHours(ytdUnpaid)} unpaid
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
