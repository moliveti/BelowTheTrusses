"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Assignment, ProjectOption, SubcontractorOption, SubcontractorRates, TimeEntry } from "@/lib/hours/types";
import { endOfWeek, fmtShortDate, startOfWeek, toIsoDate } from "@/lib/hours/dates";
import { buildCostRows } from "@/lib/hours/cost";
import { effectiveRate } from "@/lib/hours/rates";
import { fmtUsd } from "@/lib/dashboard/format";
import { RateSettings } from "./RateSettings";

type StatusFilter = "all" | "pending" | "paid";
type DateRangeFilter = "all" | "week" | "month" | "quarter" | "year";

function dateRangeBounds(range: DateRangeFilter, now: Date): { start: string; end: string } | null {
  if (range === "all") return null;
  if (range === "week") {
    return { start: toIsoDate(startOfWeek(now)), end: toIsoDate(endOfWeek(now)) };
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }
  if (range === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    const end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function matchesDateRange(e: TimeEntry, bounds: { start: string; end: string } | null): boolean {
  return bounds === null || (e.workDate >= bounds.start && e.workDate <= bounds.end);
}

function isPaid(e: TimeEntry): boolean {
  return e.paidAt !== null;
}

function matchesStatus(e: TimeEntry, status: StatusFilter): boolean {
  return status === "all" || (status === "paid") === isPaid(e);
}

interface Split {
  hours: number;
  cost: number;
  paidHours: number;
  paidCost: number;
  pendingHours: number;
  pendingCost: number;
  hasUnknownRate: boolean;
  pendingEntryIds: string[];
}

function emptySplit(): Split {
  return { hours: 0, cost: 0, paidHours: 0, paidCost: 0, pendingHours: 0, pendingCost: 0, hasUnknownRate: false, pendingEntryIds: [] };
}

function accumulate(split: Split, e: TimeEntry) {
  split.hours += e.hours;
  const cost = e.hourlyRate === null ? null : e.hours * e.hourlyRate;
  if (cost === null) split.hasUnknownRate = true;
  else split.cost += cost;
  if (isPaid(e)) {
    split.paidHours += e.hours;
    if (cost !== null) split.paidCost += cost;
  } else {
    split.pendingHours += e.hours;
    if (cost !== null) split.pendingCost += cost;
    split.pendingEntryIds.push(e.id);
  }
}

interface SubcontractorBreakdown extends Split {
  subcontractorId: string;
  subcontractorName: string;
  byProject: (Split & { projectId: string; projectName: string })[];
}

function buildSubcontractorBreakdowns(entries: TimeEntry[]): SubcontractorBreakdown[] {
  const bySub = new Map<string, SubcontractorBreakdown>();
  for (const e of entries) {
    if (!bySub.has(e.subcontractorId)) {
      bySub.set(e.subcontractorId, {
        ...emptySplit(),
        subcontractorId: e.subcontractorId,
        subcontractorName: e.subcontractorName,
        byProject: [],
      });
    }
    const sub = bySub.get(e.subcontractorId)!;
    accumulate(sub, e);
    let proj = sub.byProject.find((p) => p.projectId === e.projectId);
    if (!proj) {
      proj = { ...emptySplit(), projectId: e.projectId, projectName: e.projectName };
      sub.byProject.push(proj);
    }
    accumulate(proj, e);
  }
  return Array.from(bySub.values()).sort((a, b) => b.cost - a.cost);
}

interface ProjectBreakdown extends Split {
  projectId: string;
  projectName: string;
  byContractor: (Split & { subcontractorId: string; subcontractorName: string })[];
}

function buildProjectBreakdowns(entries: TimeEntry[]): ProjectBreakdown[] {
  const byProj = new Map<string, ProjectBreakdown>();
  for (const e of entries) {
    if (!byProj.has(e.projectId)) {
      byProj.set(e.projectId, { ...emptySplit(), projectId: e.projectId, projectName: e.projectName, byContractor: [] });
    }
    const proj = byProj.get(e.projectId)!;
    accumulate(proj, e);
    let sub = proj.byContractor.find((s) => s.subcontractorId === e.subcontractorId);
    if (!sub) {
      sub = { ...emptySplit(), subcontractorId: e.subcontractorId, subcontractorName: e.subcontractorName };
      proj.byContractor.push(sub);
    }
    accumulate(sub, e);
  }
  return Array.from(byProj.values()).sort((a, b) => b.cost - a.cost);
}

export function ContractedWorkTab({
  entries: initialEntries,
  subcontractors: initialSubcontractors,
  activeProjects,
  initialAssignments,
  rates: initialRates,
}: {
  entries: TimeEntry[];
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  initialAssignments: Assignment[];
  rates: SubcontractorRates[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [subcontractors, setSubcontractors] = useState(initialSubcontractors);
  const [rates, setRates] = useState(initialRates);
  const [subFilter, setSubFilter] = useState<string>("all");
  const [projFilter, setProjFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all");
  const [subTab, setSubTab] = useState<"overview" | "time" | "rates" | "assignments">("overview");
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  function handleSubcontractorAdded(sub: SubcontractorRates) {
    setSubcontractors((prev) => [...prev, { id: sub.id, name: sub.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setRates((prev) => [...prev, sub]);
  }

  const weekStartIso = toIsoDate(startOfWeek(new Date()));
  const weekEndIso = toIsoDate(endOfWeek(new Date()));

  // Shared by both Overview and Time Input -- one filter bar drives
  // everything, per the ask to be able to filter all of it by billing status
  // and by date range.
  const dateBounds = useMemo(() => dateRangeBounds(dateRangeFilter, new Date()), [dateRangeFilter]);
  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (subFilter === "all" || e.subcontractorId === subFilter) &&
          (projFilter === "all" || e.projectId === projFilter) &&
          matchesStatus(e, statusFilter) &&
          matchesDateRange(e, dateBounds)
      ),
    [entries, subFilter, projFilter, statusFilter, dateBounds]
  );

  const thisWeek = filtered.filter((e) => e.workDate >= weekStartIso && e.workDate <= weekEndIso);
  const weekBySubcontractor = groupHourTotals(thisWeek, (e) => e.subcontractorName);

  const costRows = useMemo(() => buildCostRows(filtered, assignments), [filtered, assignments]);
  const subBreakdowns = useMemo(() => buildSubcontractorBreakdowns(filtered), [filtered]);
  const projBreakdowns = useMemo(() => buildProjectBreakdowns(filtered), [filtered]);

  async function markPaid(entryIds: string[]) {
    if (entryIds.length === 0) return;
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const { error } = await supabase.from("subcontractor_time_entries").update({ paid_at: today }).in("id", entryIds);
    if (!error) {
      setEntries((prev) => prev.map((e) => (entryIds.includes(e.id) ? { ...e, paidAt: today } : e)));
    }
  }

  async function deleteEntry(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("subcontractor_time_entries").delete().eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // "assignments" sub-tab is hidden for now (not currently useful) but the
  // tab/content logic below is left in place in case it's wanted again.
  const SUB_TABS: { key: typeof subTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "time", label: "Time Input" },
    { key: "rates", label: "Contractor Hourly Rate Setup" },
  ];

  const pendingCount = filtered.filter((e) => !isPaid(e)).length;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Hourly Cost of Contracted Work</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours &amp; Invoicing</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wide transition ${
              subTab === t.key ? "border-b-2 border-brand-accent text-ink" : "text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(subTab === "overview" || subTab === "time") && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="all">All subcontractors</option>
            {subcontractors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={projFilter}
            onChange={(e) => setProjFilter(e.target.value)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="all">All projects</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="all">All billing status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
          </select>
          {pendingCount > 0 && (
            <button
              onClick={() => markPaid(filtered.filter((e) => !isPaid(e)).map((e) => e.id))}
              className="border border-ink px-3 py-1 font-mono text-[10.5px] uppercase text-ink hover:bg-canvas"
            >
              Mark {pendingCount} Filtered {pendingCount === 1 ? "Entry" : "Entries"} Paid
            </button>
          )}
        </div>
      )}

      {subTab === "overview" && (
        <>
          <section className="mb-10">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">This Week</h3>
            {weekBySubcontractor.length === 0 ? (
              <div className="border border-line bg-surface p-4 text-sm text-ink/50">No hours logged this week.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {weekBySubcontractor.map((s) => (
                  <div key={s.label} className="border border-line border-t-2 border-t-brand-accent bg-surface p-4">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-ink/50">{s.label}</div>
                    <div className="font-mono text-lg tabular-nums text-ink">{s.total.toFixed(2)} hrs</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CostBySubcontractor
              rows={subBreakdowns}
              expandedId={expandedSubId}
              onToggle={(id) => setExpandedSubId((prev) => (prev === id ? null : id))}
              onMarkPaid={markPaid}
            />
            <CostByProject
              rows={projBreakdowns}
              expandedId={expandedProjectId}
              onToggle={(id) => setExpandedProjectId((prev) => (prev === id ? null : id))}
              onMarkPaid={markPaid}
            />
          </section>
          {costRows.length === 0 && filtered.length === 0 && (
            <p className="text-sm text-ink/50">No hours match the current filters.</p>
          )}
        </>
      )}

      {subTab === "time" && (
        <>
          <section className="mb-10">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Log Time (on behalf of anyone)</h3>
            <ManualEntryForm
              subcontractors={subcontractors}
              activeProjects={activeProjects}
              onAdded={(entry) => setEntries((prev) => [entry, ...prev])}
            />
          </section>

          <section>
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">All Entries</h3>
            <EntriesTable entries={filtered} onDelete={deleteEntry} onMarkPaid={(id) => markPaid([id])} />
          </section>
        </>
      )}

      {subTab === "rates" && (
        <section>
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Contractor Hourly Rate Setup</h3>
          <RateSettings initialRates={rates} onSubcontractorAdded={handleSubcontractorAdded} />
        </section>
      )}

      {subTab === "assignments" && (
        <section>
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Project Assignments</h3>
          <AssignmentManager
            subcontractors={subcontractors}
            activeProjects={activeProjects}
            assignments={assignments}
            setAssignments={setAssignments}
            rates={rates}
            entries={entries}
          />
        </section>
      )}
    </div>
  );
}

function groupHourTotals(entries: TimeEntry[], keyFn: (e: TimeEntry) => string) {
  const totals = new Map<string, number>();
  for (const e of entries) {
    totals.set(keyFn(e), (totals.get(keyFn(e)) ?? 0) + e.hours);
  }
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function StatusBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide ${
        paid ? "border-positive text-positive" : "border-ink/30 text-ink/60"
      }`}
    >
      {paid ? "Paid" : "Pending"}
    </span>
  );
}

function CostBySubcontractor({
  rows,
  expandedId,
  onToggle,
  onMarkPaid,
}: {
  rows: SubcontractorBreakdown[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onMarkPaid: (entryIds: string[]) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Cost by Subcontractor</h3>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Pending</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-sm text-ink/50">
                  No hours match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <>
                  <tr
                    key={r.subcontractorId}
                    onClick={() => onToggle(r.subcontractorId)}
                    className="cursor-pointer border-b border-line hover:bg-canvas"
                  >
                    <td className="px-3 py-2">
                      <span className="mr-1.5 inline-block w-3 text-[10px] text-ink/40">
                        {expandedId === r.subcontractorId ? "▼" : "▶"}
                      </span>
                      {r.subcontractorName}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.hours.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-positive">{fmtUsd(r.paidCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(r.pendingCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmtUsd(r.cost)}
                      {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                    </td>
                  </tr>
                  {expandedId === r.subcontractorId && (
                    <tr key={`${r.subcontractorId}-detail`} className="border-b border-line bg-canvas">
                      <td colSpan={5} className="p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-ink/50">By Project</span>
                          {r.pendingEntryIds.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkPaid(r.pendingEntryIds);
                              }}
                              className="font-mono text-[10.5px] uppercase text-positive underline underline-offset-2"
                            >
                              Mark All Pending Paid
                            </button>
                          )}
                        </div>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-line">
                              <th className="px-2 py-1 text-left font-mono text-[9.5px] uppercase text-ink/40">Project</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Hours</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Paid $</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Pending $</th>
                              <th className="px-2 py-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {r.byProject
                              .sort((a, b) => b.cost - a.cost)
                              .map((p) => (
                                <tr key={p.projectId} className="border-b border-line last:border-b-0">
                                  <td className="px-2 py-1">{p.projectName}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums">{p.hours.toFixed(2)}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums text-positive">{fmtUsd(p.paidCost)}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtUsd(p.pendingCost)}</td>
                                  <td className="px-2 py-1 text-right">
                                    {p.pendingEntryIds.length > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onMarkPaid(p.pendingEntryIds);
                                        }}
                                        className="font-mono text-[9.5px] uppercase text-positive underline underline-offset-2"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-ink/40">* some hours have no rate set on their assignment — cost is understated.</p>
    </div>
  );
}

function CostByProject({
  rows,
  expandedId,
  onToggle,
  onMarkPaid,
}: {
  rows: ProjectBreakdown[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onMarkPaid: (entryIds: string[]) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Cost by Project</h3>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Paid</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Pending</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-sm text-ink/50">
                  No hours match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <>
                  <tr
                    key={r.projectId}
                    onClick={() => onToggle(r.projectId)}
                    className="cursor-pointer border-b border-line hover:bg-canvas"
                  >
                    <td className="px-3 py-2">
                      <span className="mr-1.5 inline-block w-3 text-[10px] text-ink/40">
                        {expandedId === r.projectId ? "▼" : "▶"}
                      </span>
                      {r.projectName}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.hours.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-positive">{fmtUsd(r.paidCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtUsd(r.pendingCost)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {fmtUsd(r.cost)}
                      {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                    </td>
                  </tr>
                  {expandedId === r.projectId && (
                    <tr key={`${r.projectId}-detail`} className="border-b border-line bg-canvas">
                      <td colSpan={5} className="p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-wide text-ink/50">By Contractor</span>
                          {r.pendingEntryIds.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkPaid(r.pendingEntryIds);
                              }}
                              className="font-mono text-[10.5px] uppercase text-positive underline underline-offset-2"
                            >
                              Mark All Pending Paid
                            </button>
                          )}
                        </div>
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-line">
                              <th className="px-2 py-1 text-left font-mono text-[9.5px] uppercase text-ink/40">Contractor</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Hours</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Paid $</th>
                              <th className="px-2 py-1 text-right font-mono text-[9.5px] uppercase text-ink/40">Pending $</th>
                              <th className="px-2 py-1" />
                            </tr>
                          </thead>
                          <tbody>
                            {r.byContractor
                              .sort((a, b) => b.cost - a.cost)
                              .map((s) => (
                                <tr key={s.subcontractorId} className="border-b border-line last:border-b-0">
                                  <td className="px-2 py-1">{s.subcontractorName}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums">{s.hours.toFixed(2)}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums text-positive">{fmtUsd(s.paidCost)}</td>
                                  <td className="px-2 py-1 text-right font-mono tabular-nums">{fmtUsd(s.pendingCost)}</td>
                                  <td className="px-2 py-1 text-right">
                                    {s.pendingEntryIds.length > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onMarkPaid(s.pendingEntryIds);
                                        }}
                                        className="font-mono text-[9.5px] uppercase text-positive underline underline-offset-2"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManualEntryForm({
  subcontractors,
  activeProjects,
  onAdded,
}: {
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  onAdded: (entry: TimeEntry) => void;
}) {
  const [subcontractorId, setSubcontractorId] = useState(subcontractors[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [workDate, setWorkDate] = useState(toIsoDate(new Date()));
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const hoursNum = Number(hours);
    if (!subcontractorId) return setError("Pick a subcontractor.");
    if (!projectId) return setError("Pick a project.");
    if (!hoursNum || hoursNum <= 0 || hoursNum > 24 || Math.round(hoursNum * 4) !== hoursNum * 4) {
      return setError("Hours must be in 15-minute increments (e.g. 1.25, 3.5).");
    }
    if (!description.trim()) return setError("Add a short description of the work.");

    setSaving(true);
    const supabase = createClient();
    const sub = subcontractors.find((s) => s.id === subcontractorId);
    const project = activeProjects.find((p) => p.id === projectId);
    const { data, error: insertError } = await supabase
      .from("subcontractor_time_entries")
      .insert({
        subcontractor_id: subcontractorId,
        project_id: projectId,
        work_date: workDate,
        hours: hoursNum,
        work_description: description.trim(),
      })
      .select("id, work_date, hours, work_description, hourly_rate")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    onAdded({
      id: data.id,
      subcontractorId,
      subcontractorName: sub?.name ?? "",
      projectId,
      projectName: project?.name ?? "",
      workDate: data.work_date,
      hours: data.hours,
      workDescription: data.work_description,
      hourlyRate: data.hourly_rate,
      paidAt: null,
    });
    setHours("");
    setDescription("");
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border border-line bg-surface p-4 sm:grid-cols-5">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Subcontractor</label>
        <select
          value={subcontractorId}
          onChange={(e) => {
            setSubcontractorId(e.target.value);
            setProjectId("");
          }}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          <option value="">Select…</option>
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Date</label>
        <input
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Hours</label>
        <input
          type="number"
          step={0.25}
          min={0.25}
          max={24}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="3.5"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Elevations"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div className="col-span-2 sm:col-span-5">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add entry"}
        </button>
        {error && <span className="ml-3 text-xs text-warning">{error}</span>}
      </div>
    </form>
  );
}

function EntriesTable({
  entries,
  onDelete,
  onMarkPaid,
}: {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  onMarkPaid: (id: string) => void;
}) {
  const total = entries.reduce((s, e) => s + e.hours, 0);

  if (entries.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No matching entries.</div>;
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[860px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Subcontractor</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Description</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-line hover:bg-canvas">
              <td className="px-3 py-2 font-mono">{fmtShortDate(e.workDate)}</td>
              <td className="px-3 py-2">{e.subcontractorName}</td>
              <td className="px-3 py-2">{e.projectName}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{e.hours.toFixed(2)}</td>
              <td className="px-3 py-2">{e.workDescription}</td>
              <td className="px-3 py-2">
                <StatusBadge paid={e.paidAt !== null} />
                {e.paidAt && <div className="mt-0.5 font-mono text-[9.5px] text-ink/40">{fmtShortDate(e.paidAt)}</div>}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  {e.paidAt === null && (
                    <button
                      onClick={() => onMarkPaid(e.id)}
                      className="font-mono text-[11px] text-positive underline underline-offset-2"
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(e.id)}
                    className="font-mono text-[11px] text-warning underline underline-offset-2"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t-[1.5px] border-ink font-bold">
            <td className="px-3 py-2" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{total.toFixed(2)}</td>
            <td className="px-3 py-2" colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AssignmentManager({
  subcontractors,
  activeProjects,
  assignments,
  setAssignments,
  rates,
  entries,
}: {
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  rates: SubcontractorRates[];
  entries: TimeEntry[];
}) {
  const [selectedSub, setSelectedSub] = useState(subcontractors[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const assignmentByProject = new Map(
    assignments.filter((a) => a.subcontractorId === selectedSub).map((a) => [a.projectId, a])
  );

  const hoursLoggedByProject = new Map<string, number>();
  for (const e of entries) {
    if (e.subcontractorId !== selectedSub) continue;
    hoursLoggedByProject.set(e.projectId, (hoursLoggedByProject.get(e.projectId) ?? 0) + e.hours);
  }

  const visibleProjects = activeProjects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  async function toggle(projectId: string) {
    if (!selectedSub) return;
    setPending(projectId);
    const supabase = createClient();
    const isAssigned = assignmentByProject.has(projectId);

    if (isAssigned) {
      const { error } = await supabase
        .from("project_subcontractors")
        .delete()
        .eq("project_id", projectId)
        .eq("subcontractor_id", selectedSub);
      if (!error) {
        setAssignments((prev) => prev.filter((a) => !(a.projectId === projectId && a.subcontractorId === selectedSub)));
      }
    } else {
      const project = activeProjects.find((p) => p.id === projectId);
      const subRates = rates.find((r) => r.id === selectedSub);
      const autoRate = project ? effectiveRate(subRates, project.type) : null;
      const { error } = await supabase
        .from("project_subcontractors")
        .insert({ project_id: projectId, subcontractor_id: selectedSub, hourly_rate: autoRate });
      if (!error) {
        setAssignments((prev) => [
          ...prev,
          { projectId, subcontractorId: selectedSub, hourlyRate: autoRate, allocatedHours: null },
        ]);
      }
    }
    setPending(null);
  }

  async function updateRate(projectId: string, field: "hourlyRate" | "allocatedHours", value: string) {
    const num = value === "" ? null : Number(value);
    const column = field === "hourlyRate" ? "hourly_rate" : "allocated_hours";
    const supabase = createClient();
    const { error } = await supabase
      .from("project_subcontractors")
      .update({ [column]: num })
      .eq("project_id", projectId)
      .eq("subcontractor_id", selectedSub);
    if (!error) {
      setAssignments((prev) =>
        prev.map((a) => (a.projectId === projectId && a.subcontractorId === selectedSub ? { ...a, [field]: num } : a))
      );
    }
  }

  return (
    <div className="border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={selectedSub}
          onChange={(e) => setSelectedSub(e.target.value)}
          className="border border-line px-2 py-1 text-xs"
        >
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-line px-2 py-1 text-xs"
        />
      </div>
      <div className="max-h-[28rem] overflow-y-auto border border-line">
        {visibleProjects.map((p) => {
          const assignment = assignmentByProject.get(p.id);
          const isAssigned = !!assignment;
          const logged = hoursLoggedByProject.get(p.id) ?? 0;
          return (
            <div key={p.id} className="border-b border-line px-3 py-1.5 text-[13px] last:border-b-0 hover:bg-canvas">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex flex-1 min-w-[160px] cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={pending === p.id}
                    onChange={() => toggle(p.id)}
                  />
                  <span>{p.name}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase text-ink/40">{p.type}</span>
                </label>
                {isAssigned && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Rate $/hr"
                      defaultValue={assignment?.hourlyRate ?? ""}
                      onBlur={(e) => updateRate(p.id, "hourlyRate", e.target.value)}
                      className="w-24 border border-line px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Alloc. hrs"
                      defaultValue={assignment?.allocatedHours ?? ""}
                      onBlur={(e) => updateRate(p.id, "allocatedHours", e.target.value)}
                      className="w-24 border border-line px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>
              {isAssigned && (logged > 0 || assignment?.allocatedHours) && (
                <div className="mt-1.5 pl-6">
                  <BurndownBar logged={logged} allocated={assignment?.allocatedHours ?? null} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BurndownBar({ logged, allocated }: { logged: number; allocated: number | null }) {
  if (allocated === null) {
    return <div className="font-mono text-[10.5px] text-ink/40">{logged.toFixed(1)} hrs logged · no allocation set</div>;
  }
  const pct = allocated > 0 ? Math.min(100, (logged / allocated) * 100) : 100;
  const over = logged > allocated;
  const remaining = allocated - logged;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-40 max-w-[40vw] overflow-hidden bg-line">
        <div
          className={`h-full ${over ? "bg-warning" : "bg-brand-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`font-mono text-[10.5px] ${over ? "text-warning" : "text-ink/50"}`}>
        {logged.toFixed(1)} / {allocated.toFixed(1)} hrs
        {over ? ` · ${Math.abs(remaining).toFixed(1)} over` : ` · ${remaining.toFixed(1)} left`}
      </span>
    </div>
  );
}
