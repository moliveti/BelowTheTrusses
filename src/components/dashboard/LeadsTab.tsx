"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { ReferralSource } from "@/lib/dashboard/types";
import { toIsoDate } from "@/lib/hours/dates";
import { SCOPE_CATEGORIES } from "@/lib/scope";

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const OPEN_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified"];
const TYPES = ["Residential", "Commercial", "Furniture"] as const;

type SortField = "name" | "type" | "budget" | "referral" | "status" | "days";
type StatusFilter = "active" | "all" | LeadStatus;

function daysSince(dateIso: string): number {
  const then = new Date(dateIso).getTime();
  const now = new Date().getTime();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function staleness(days: number): { label: string; className: string } {
  if (days < 7) return { label: "text-positive", className: "border-positive text-positive" };
  if (days < 30) return { label: "text-brand-accent", className: "border-brand-accent text-brand-accent" };
  return { label: "text-warning", className: "border-warning text-warning" };
}

export function LeadsTab({
  leads: initialLeads,
  referralSources,
}: {
  leads: Lead[];
  referralSources: ReferralSource[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortField, setSortField] = useState<SortField>("days");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function upsertLead(lead: Lead) {
    setLeads((prev) => [lead, ...prev]);
  }

  function patchLead(id: string, patch: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function markContacted(id: string) {
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const { error } = await supabase.from("leads").update({ last_contacted_date: today }).eq("id", id);
    if (!error) patchLead(id, { lastContactedDate: today });
  }

  async function convertToSow(lead: Lead) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sow_sent")
      .insert({ date_sent: toIsoDate(new Date()), prospect_name: lead.name, notes: lead.notes, status: "Open" })
      .select("id")
      .single();
    if (error) return;
    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "Converted", converted_sow_id: data.id })
      .eq("id", lead.id);
    if (!updateError) patchLead(lead.id, { status: "Converted", convertedSowId: data.id });
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter === "active") return OPEN_STATUSES.includes(l.status);
      if (statusFilter === "all") return true;
      return l.status === statusFilter;
    });
  }, [leads, statusFilter]);

  const sorted = useMemo(() => {
    const withDays = filtered.map((l) => ({ lead: l, days: daysSince(l.lastContactedDate ?? l.createdAt) }));
    withDays.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.lead.name.localeCompare(b.lead.name);
          break;
        case "type":
          cmp = (a.lead.projectType ?? "").localeCompare(b.lead.projectType ?? "");
          break;
        case "budget":
          cmp = (a.lead.budgetRange ?? "").localeCompare(b.lead.budgetRange ?? "");
          break;
        case "referral":
          cmp = (a.lead.referralSourceName ?? "").localeCompare(b.lead.referralSourceName ?? "");
          break;
        case "status":
          cmp = a.lead.status.localeCompare(b.lead.status);
          break;
        case "days":
        default:
          cmp = a.days - b.days;
      }
      return sortAsc ? cmp : -cmp;
    });
    return withDays;
  }, [filtered, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((v) => !v);
    else {
      setSortField(field);
      setSortAsc(field !== "days");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Leads</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Intake &amp; Follow-Up</span>
      </div>

      <section className="mb-10">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">New Lead</h3>
        <LeadIntakeForm referralSources={referralSources} onAdded={upsertLead} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 font-mono text-xs uppercase tracking-wide text-ink/60">Leads</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="active">Active (excludes Converted/Lost)</option>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] uppercase text-ink/40">
            <span className="text-positive">● &lt;7d</span> · <span className="text-brand-accent">● &lt;30d</span> ·{" "}
            <span className="text-warning">● 30d+</span>
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">No leads match this filter.</div>
        ) : (
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[880px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <Th field="name" label="Name" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Contact</th>
                  <Th field="type" label="Type" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Scope</th>
                  <Th field="budget" label="Budget / Timeline" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                  <Th field="referral" label="Referral" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                  <Th field="status" label="Status" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                  <Th field="days" label="Last Contact" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ lead, days }) => {
                  const s = staleness(days);
                  const isOpen = expandedId === lead.id;
                  return (
                    <>
                      <tr
                        key={lead.id}
                        onClick={() => setExpandedId(isOpen ? null : lead.id)}
                        className="cursor-pointer border-b border-line hover:bg-canvas"
                      >
                        <td className="px-3 py-2">
                          <span className="mr-1.5 inline-block w-3 text-[10px] text-ink/40">{isOpen ? "▼" : "▶"}</span>
                          {lead.name}
                        </td>
                        <td className="px-3 py-2 text-ink/70">
                          {lead.email && <div>{lead.email}</div>}
                          {lead.phone && <div>{lead.phone}</div>}
                        </td>
                        <td className="px-3 py-2">{lead.projectType ?? "—"}</td>
                        <td className="px-3 py-2 text-ink/70">
                          {lead.scopeTags.length > 0 ? lead.scopeTags.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-ink/70">
                          {lead.budgetRange && <div>{lead.budgetRange}</div>}
                          {lead.timeline && <div>{lead.timeline}</div>}
                        </td>
                        <td className="px-3 py-2 text-ink/70">{lead.referralSourceName ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${s.className}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${s.label}`}>{days}d ago</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${lead.id}-edit`} className="border-b border-line bg-canvas">
                          <td colSpan={8} className="p-4">
                            <LeadEditPanel
                              lead={lead}
                              referralSources={referralSources}
                              onPatch={(patch) => patchLead(lead.id, patch)}
                              onMarkContacted={() => markContacted(lead.id)}
                              onConvert={() => convertToSow(lead)}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({
  field,
  label,
  sortField,
  sortAsc,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortAsc: boolean;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer select-none px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50 hover:text-ink"
    >
      {label} {active && (sortAsc ? "▲" : "▼")}
    </th>
  );
}

function TypeButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide ${
            value === t ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function ScopePills({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }
  return (
    <div className="flex flex-wrap gap-1">
      {SCOPE_CATEGORIES.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`px-2.5 py-1 font-mono text-[11px] ${
            value.includes(tag) ? "bg-brand-accent text-white" : "border border-line text-ink/70 hover:border-brand-accent"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

function LeadIntakeForm({
  referralSources,
  onAdded,
}: {
  referralSources: ReferralSource[];
  onAdded: (lead: Lead) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState("");
  const [scopeTags, setScopeTags] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [timeline, setTimeline] = useState("");
  const [referralSourceId, setReferralSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Name is required.");

    setSaving(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("leads")
      .insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        project_type: projectType || null,
        scope_tags: scopeTags,
        state: state.trim() || null,
        budget_range: budgetRange.trim() || null,
        timeline: timeline.trim() || null,
        referral_source_id: referralSourceId || null,
        notes: notes.trim() || null,
      })
      .select("id, created_at")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    const referral = referralSources.find((r) => r.id === referralSourceId);
    onAdded({
      id: data.id,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      projectType: projectType || null,
      scopeTags,
      state: state.trim() || null,
      budgetRange: budgetRange.trim() || null,
      timeline: timeline.trim() || null,
      referralSourceId: referralSourceId || null,
      referralSourceName: referral?.name ?? null,
      notes: notes.trim() || null,
      status: "New",
      lastContactedDate: null,
      createdAt: data.created_at,
      convertedSowId: null,
      convertedProjectId: null,
    });

    setName("");
    setEmail("");
    setPhone("");
    setProjectType("");
    setScopeTags([]);
    setState("");
    setBudgetRange("");
    setTimeline("");
    setReferralSourceId("");
    setNotes("");
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 border border-line bg-surface p-4 sm:grid-cols-4">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">State</label>
        <input value={state} onChange={(e) => setState(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Type</label>
        <TypeButtons value={projectType} onChange={setProjectType} />
      </div>

      {projectType === "Residential" && (
        <div className="col-span-2 sm:col-span-4">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Scope of Interest</label>
          <ScopePills value={scopeTags} onChange={setScopeTags} />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Client Budget</label>
        <input
          value={budgetRange}
          onChange={(e) => setBudgetRange(e.target.value)}
          placeholder="e.g. $10k–$20k"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Timeline</label>
        <input
          value={timeline}
          onChange={(e) => setTimeline(e.target.value)}
          placeholder="e.g. Spring 2027"
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Referral Source</label>
        <select
          value={referralSourceId}
          onChange={(e) => setReferralSourceId(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          <option value="">—</option>
          {referralSources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary px-4 py-1.5 text-xs text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add lead"}
        </button>
        {error && <span className="ml-3 text-xs text-warning">{error}</span>}
      </div>
    </form>
  );
}

function LeadEditPanel({
  lead,
  referralSources,
  onPatch,
  onMarkContacted,
  onConvert,
}: {
  lead: Lead;
  referralSources: ReferralSource[];
  onPatch: (patch: Partial<Lead>) => void;
  onMarkContacted: () => void;
  onConvert: () => void;
}) {
  async function update(column: string, value: string | string[] | null, patch: Partial<Lead>) {
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ [column]: value }).eq("id", lead.id);
    if (!error) onPatch(patch);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" onClick={(e) => e.stopPropagation()}>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Name</label>
        <input
          defaultValue={lead.name}
          onBlur={(e) => update("name", e.target.value, { name: e.target.value })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Email</label>
        <input
          defaultValue={lead.email ?? ""}
          onBlur={(e) => update("email", e.target.value || null, { email: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Phone</label>
        <input
          defaultValue={lead.phone ?? ""}
          onBlur={(e) => update("phone", e.target.value || null, { phone: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">State</label>
        <input
          defaultValue={lead.state ?? ""}
          onBlur={(e) => update("state", e.target.value || null, { state: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Type</label>
        <TypeButtons value={lead.projectType ?? ""} onChange={(v) => update("project_type", v, { projectType: v })} />
      </div>

      {lead.projectType === "Residential" && (
        <div className="col-span-2 sm:col-span-4">
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Scope of Interest</label>
          <ScopePills value={lead.scopeTags} onChange={(v) => update("scope_tags", v, { scopeTags: v })} />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Client Budget</label>
        <input
          defaultValue={lead.budgetRange ?? ""}
          onBlur={(e) => update("budget_range", e.target.value || null, { budgetRange: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Timeline</label>
        <input
          defaultValue={lead.timeline ?? ""}
          onBlur={(e) => update("timeline", e.target.value || null, { timeline: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Referral Source</label>
        <select
          defaultValue={lead.referralSourceId ?? ""}
          onChange={(e) => {
            const referral = referralSources.find((r) => r.id === e.target.value);
            update("referral_source_id", e.target.value || null, {
              referralSourceId: e.target.value || null,
              referralSourceName: referral?.name ?? null,
            });
          }}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          <option value="">—</option>
          {referralSources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Status</label>
        <select
          defaultValue={lead.status}
          onChange={(e) => update("status", e.target.value, { status: e.target.value as LeadStatus })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 sm:col-span-4">
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Notes</label>
        <input
          defaultValue={lead.notes ?? ""}
          onBlur={(e) => update("notes", e.target.value || null, { notes: e.target.value || null })}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
      </div>

      <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
        <button
          onClick={onMarkContacted}
          className="bg-brand-primary px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90"
        >
          Mark Contacted Today
        </button>
        {!lead.convertedSowId && lead.status !== "Converted" && lead.status !== "Lost" && (
          <button
            onClick={onConvert}
            className="font-mono text-[11px] uppercase text-brand-primary underline underline-offset-2"
          >
            Convert to SOW
          </button>
        )}
        {lead.lastContactedDate && (
          <span className="ml-auto font-mono text-[10px] text-ink/40">Last contacted {lead.lastContactedDate}</span>
        )}
      </div>
    </div>
  );
}
