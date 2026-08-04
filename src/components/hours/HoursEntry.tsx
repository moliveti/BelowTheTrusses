"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectOption, SubcontractorProfile, TimeEntry } from "@/lib/hours/types";
import { endOfWeek, fmtShortDate, startOfWeek, toIsoDate } from "@/lib/hours/dates";

export function HoursEntry({
  subcontractor,
  projects,
  initialEntries,
}: {
  subcontractor: SubcontractorProfile;
  projects: ProjectOption[];
  initialEntries: TimeEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(toIsoDate(new Date()));
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekStartIso = toIsoDate(weekStart);
  const weekEndIso = toIsoDate(weekEnd);

  const thisWeek = useMemo(
    () => entries.filter((e) => e.workDate >= weekStartIso && e.workDate <= weekEndIso),
    [entries, weekStartIso, weekEndIso]
  );
  const earlier = useMemo(() => entries.filter((e) => e.workDate < weekStartIso), [entries, weekStartIso]);
  const weekTotal = thisWeek.reduce((s, e) => s + e.hours, 0);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const hoursNum = Number(hours);
    if (!projectId) return setError("Pick a project.");
    if (!hoursNum || hoursNum <= 0 || hoursNum > 24 || Math.round(hoursNum * 4) !== hoursNum * 4) {
      return setError("Hours must be in 15-minute increments (e.g. 1.25, 3.5).");
    }
    if (!description.trim()) return setError("Add a short description of the work.");

    setSaving(true);
    const supabase = createClient();
    const project = projects.find((p) => p.id === projectId);
    const { data, error: insertError } = await supabase
      .from("subcontractor_time_entries")
      .insert({
        subcontractor_id: subcontractor.id,
        project_id: projectId,
        work_date: workDate,
        hours: hoursNum,
        work_description: description.trim(),
      })
      .select("id, project_id, work_date, hours, work_description")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setEntries((prev) => [
      {
        id: data.id,
        subcontractorId: subcontractor.id,
        subcontractorName: subcontractor.name,
        projectId: data.project_id,
        projectName: project?.name ?? "",
        workDate: data.work_date,
        hours: data.hours,
        workDescription: data.work_description,
        hourlyRate: null,
      },
      ...prev,
    ]);
    setHours("");
    setDescription("");
  }

  async function deleteEntry(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("subcontractor_time_entries").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-6 text-xs text-ink/60">Logging hours as {subcontractor.name}</p>

      <div className="mb-8 border border-line bg-surface p-5">
        <h2 className="mb-4 text-base text-ink">Log time</h2>
        <form onSubmit={addEntry} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink/60">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
            >
              {projects.length === 0 && <option value="">No projects assigned</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink/60">Date</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink/60">Hours (15-min increments)</label>
            <input
              type="number"
              step={0.25}
              min={0.25}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 3.5"
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink/60">Work Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Elevations"
              className="w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={saving || projects.length === 0}
              className="bg-brand-primary px-4 py-2 text-sm text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add entry"}
            </button>
            {error && <span className="ml-3 text-xs text-warning">{error}</span>}
          </div>
        </form>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
          <h2 className="text-base text-ink">This Week</h2>
          <span className="font-mono text-xs tabular-nums text-ink/60">{weekTotal.toFixed(2)} hrs total</span>
        </div>
        <EntryTable entries={thisWeek} onDelete={deleteEntry} emptyLabel="No entries logged this week yet." />
      </div>

      <div>
        <button
          onClick={() => setShowEarlier((v) => !v)}
          className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60 underline underline-offset-2"
        >
          {showEarlier ? "Hide earlier entries" : `Show earlier entries (${earlier.length})`}
        </button>
        {showEarlier && <EntryTable entries={earlier} onDelete={deleteEntry} emptyLabel="No earlier entries." />}
      </div>
    </div>
  );
}

function EntryTable({
  entries,
  onDelete,
  emptyLabel,
}: {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">{emptyLabel}</div>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Date</th>
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
        </tbody>
      </table>
    </div>
  );
}
