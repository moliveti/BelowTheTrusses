"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectOption, SubcontractorOption, TimeEntry } from "@/lib/hours/types";
import { endOfWeek, fmtShortDate, startOfWeek, toIsoDate } from "@/lib/hours/dates";

interface Assignment {
  projectId: string;
  subcontractorId: string;
}

export function ContractedWorkTab({
  entries,
  subcontractors,
  activeProjects,
  initialAssignments,
}: {
  entries: TimeEntry[];
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  initialAssignments: Assignment[];
}) {
  const [subFilter, setSubFilter] = useState<string>("all");
  const [projFilter, setProjFilter] = useState<string>("all");

  const weekStartIso = toIsoDate(startOfWeek(new Date()));
  const weekEndIso = toIsoDate(endOfWeek(new Date()));

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (subFilter === "all" || e.subcontractorId === subFilter) &&
          (projFilter === "all" || e.projectId === projFilter)
      ),
    [entries, subFilter, projFilter]
  );

  const thisWeek = filtered.filter((e) => e.workDate >= weekStartIso && e.workDate <= weekEndIso);
  const weekBySubcontractor = groupTotals(thisWeek, (e) => e.subcontractorName);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Contracted Work</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours &amp; Invoicing</span>
      </div>

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

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 font-mono text-xs uppercase tracking-wide text-ink/60">All Entries</h3>
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
        </div>
        <EntriesTable entries={filtered} />
      </section>

      <section>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Project Assignments</h3>
        <AssignmentManager
          subcontractors={subcontractors}
          activeProjects={activeProjects}
          initialAssignments={initialAssignments}
        />
      </section>
    </div>
  );
}

function groupTotals(entries: TimeEntry[], keyFn: (e: TimeEntry) => string) {
  const totals = new Map<string, number>();
  for (const e of entries) {
    totals.set(keyFn(e), (totals.get(keyFn(e)) ?? 0) + e.hours);
  }
  return Array.from(totals.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

function EntriesTable({ entries }: { entries: TimeEntry[] }) {
  const total = entries.reduce((s, e) => s + e.hours, 0);

  if (entries.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No matching entries.</div>;
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Subcontractor</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Description</th>
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
            </tr>
          ))}
          <tr className="border-t-[1.5px] border-ink font-bold">
            <td className="px-3 py-2" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{total.toFixed(2)}</td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AssignmentManager({
  subcontractors,
  activeProjects,
  initialAssignments,
}: {
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  initialAssignments: Assignment[];
}) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [selectedSub, setSelectedSub] = useState(subcontractors[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const assignedProjectIds = new Set(
    assignments.filter((a) => a.subcontractorId === selectedSub).map((a) => a.projectId)
  );

  const visibleProjects = activeProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  async function toggle(projectId: string) {
    if (!selectedSub) return;
    setPending(projectId);
    const supabase = createClient();
    const isAssigned = assignedProjectIds.has(projectId);

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
      const { error } = await supabase
        .from("project_subcontractors")
        .insert({ project_id: projectId, subcontractor_id: selectedSub });
      if (!error) {
        setAssignments((prev) => [...prev, { projectId, subcontractorId: selectedSub }]);
      }
    }
    setPending(null);
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
      <div className="max-h-64 overflow-y-auto border border-line">
        {visibleProjects.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 text-[13px] last:border-b-0 hover:bg-canvas"
          >
            <input
              type="checkbox"
              checked={assignedProjectIds.has(p.id)}
              disabled={pending === p.id}
              onChange={() => toggle(p.id)}
            />
            <span>{p.name}</span>
            <span className="ml-auto font-mono text-[10px] uppercase text-ink/40">{p.type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
