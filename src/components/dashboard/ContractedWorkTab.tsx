"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Assignment, ProjectOption, SubcontractorOption, TimeEntry } from "@/lib/hours/types";
import { endOfWeek, fmtShortDate, startOfWeek, toIsoDate } from "@/lib/hours/dates";
import { buildCostRows } from "@/lib/hours/cost";
import { fmtUsd } from "@/lib/dashboard/format";

export function ContractedWorkTab({
  entries: initialEntries,
  subcontractors,
  activeProjects,
  initialAssignments,
}: {
  entries: TimeEntry[];
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  initialAssignments: Assignment[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [assignments, setAssignments] = useState(initialAssignments);
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
  const weekBySubcontractor = groupHourTotals(thisWeek, (e) => e.subcontractorName);

  const costRows = useMemo(() => buildCostRows(entries, assignments), [entries, assignments]);

  async function deleteEntry(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("subcontractor_time_entries").delete().eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

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

      <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CostBySubcontractor rows={costRows} />
        <CostByProject rows={costRows} />
      </section>

      <section className="mb-10">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Log Time (on behalf of anyone)</h3>
        <ManualEntryForm
          subcontractors={subcontractors}
          activeProjects={activeProjects}
          onAdded={(entry) => setEntries((prev) => [entry, ...prev])}
        />
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
        <EntriesTable entries={filtered} onDelete={deleteEntry} />
      </section>

      <section>
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Project Assignments</h3>
        <AssignmentManager
          subcontractors={subcontractors}
          activeProjects={activeProjects}
          assignments={assignments}
          setAssignments={setAssignments}
        />
      </section>
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

function CostBySubcontractor({ rows }: { rows: ReturnType<typeof buildCostRows> }) {
  const bySub = new Map<string, { name: string; hours: number; allocated: number; cost: number; hasUnknownRate: boolean }>();
  for (const r of rows) {
    if (!bySub.has(r.subcontractorId)) {
      bySub.set(r.subcontractorId, { name: r.subcontractorName, hours: 0, allocated: 0, cost: 0, hasUnknownRate: false });
    }
    const entry = bySub.get(r.subcontractorId)!;
    entry.hours += r.hours;
    entry.allocated += r.allocatedHours ?? 0;
    if (r.cost === null) entry.hasUnknownRate = true;
    else entry.cost += r.cost;
  }
  const list = Array.from(bySub.values()).sort((a, b) => b.cost - a.cost);

  return (
    <div>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Cost by Subcontractor</h3>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Allocated</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-sm text-ink/50">
                  No hours logged yet.
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.name} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.hours.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.allocated ? r.allocated.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmtUsd(r.cost)}
                    {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-ink/40">* some hours have no rate set on their assignment — cost is understated.</p>
    </div>
  );
}

function CostByProject({ rows }: { rows: ReturnType<typeof buildCostRows> }) {
  const byProject = new Map<string, { name: string; hours: number; cost: number; hasUnknownRate: boolean }>();
  for (const r of rows) {
    if (!byProject.has(r.projectId)) {
      byProject.set(r.projectId, { name: r.projectName, hours: 0, cost: 0, hasUnknownRate: false });
    }
    const entry = byProject.get(r.projectId)!;
    entry.hours += r.hours;
    if (r.cost === null) entry.hasUnknownRate = true;
    else entry.cost += r.cost;
  }
  const list = Array.from(byProject.values()).sort((a, b) => b.cost - a.cost);

  return (
    <div>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Cost by Project</h3>
      <div className="overflow-x-auto border border-line bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
              <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-sm text-ink/50">
                  No hours logged yet.
                </td>
              </tr>
            ) : (
              list.map((r) => (
                <tr key={r.name} className="border-b border-line hover:bg-canvas">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.hours.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmtUsd(r.cost)}
                    {r.hasUnknownRate && <span className="ml-1 text-warning">*</span>}
                  </td>
                </tr>
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
      .select("id, work_date, hours, work_description")
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

function EntriesTable({ entries, onDelete }: { entries: TimeEntry[]; onDelete: (id: string) => void }) {
  const total = entries.reduce((s, e) => s + e.hours, 0);

  if (entries.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No matching entries.</div>;
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Subcontractor</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Project</th>
            <th className="px-3 py-2 text-right font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Hours</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Description</th>
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
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onDelete(e.id)}
                  className="font-mono text-[11px] text-warning underline underline-offset-2"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t-[1.5px] border-ink font-bold">
            <td className="px-3 py-2" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">{total.toFixed(2)}</td>
            <td className="px-3 py-2" colSpan={2} />
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
}: {
  subcontractors: SubcontractorOption[];
  activeProjects: ProjectOption[];
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
}) {
  const [selectedSub, setSelectedSub] = useState(subcontractors[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const assignmentByProject = new Map(
    assignments.filter((a) => a.subcontractorId === selectedSub).map((a) => [a.projectId, a])
  );

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
      const { error } = await supabase
        .from("project_subcontractors")
        .insert({ project_id: projectId, subcontractor_id: selectedSub });
      if (!error) {
        setAssignments((prev) => [
          ...prev,
          { projectId, subcontractorId: selectedSub, hourlyRate: null, allocatedHours: null },
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
      <div className="max-h-80 overflow-y-auto border border-line">
        {visibleProjects.map((p) => {
          const assignment = assignmentByProject.get(p.id);
          const isAssigned = !!assignment;
          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 text-[13px] last:border-b-0 hover:bg-canvas"
            >
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
          );
        })}
      </div>
    </div>
  );
}
