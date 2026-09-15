"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { ReferralSource } from "@/lib/dashboard/types";
import type { MilestoneTemplateGroup } from "@/lib/milestoneTemplates/types";
import { toIsoDate } from "@/lib/hours/dates";
import { SCOPE_CATEGORIES } from "@/lib/scope";
import type { SelectionCatalogItem } from "@/lib/quotes/types";
import type { ClientOption } from "@/lib/clients/types";
import type { Role } from "@/lib/profile";
import { canBuildQuotes } from "@/lib/permissions";
import { isValidBudgetRange, isValidEmail, isValidPhone } from "@/lib/validation";
import { ProjectKickoffPanel } from "./ProjectKickoffPanel";
import { QuoteBuilderPanel } from "./QuoteBuilderPanel";

const STATUSES: LeadStatus[] = [
  "New Prospect",
  "Quote Sent",
  "Contract Submitted",
  "Signed Contract",
  "Lost",
  "Business Not Materialized",
];
const OPEN_STATUSES: LeadStatus[] = ["New Prospect", "Quote Sent", "Contract Submitted"];
const TYPES = ["Residential", "Commercial", "Furniture"] as const;
const REFERRAL_TYPES = ["Past Client", "Realtor", "Vendor", "Other"] as const;
const NEW_SOURCE_SENTINEL = "__new__";

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

// <input type="month"> uses "YYYY-MM"; the DB stores the 1st of that month.
function monthInputValue(dateIso: string | null): string {
  return dateIso ? dateIso.slice(0, 7) : "";
}

function monthInputToDate(month: string): string | null {
  return month ? `${month}-01` : null;
}

function formatMonth(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatTimelineRange(start: string | null, end: string | null): string | null {
  if (start && end) {
    return start === end ? formatMonth(start) : `${formatMonth(start)} – ${formatMonth(end)}`;
  }
  if (start) return `From ${formatMonth(start)}`;
  if (end) return `By ${formatMonth(end)}`;
  return null;
}

export function LeadsTab({
  leads: initialLeads,
  referralSources: initialReferralSources,
  milestoneTemplates,
  selectionCatalog,
  clients,
  quotesByLeadId: initialQuotesByLeadId,
  role,
}: {
  leads: Lead[];
  referralSources: ReferralSource[];
  milestoneTemplates: MilestoneTemplateGroup[];
  selectionCatalog: SelectionCatalogItem[];
  clients: ClientOption[];
  quotesByLeadId: Record<string, string>;
  role: Role | null;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [referralSources, setReferralSources] = useState(initialReferralSources);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortField, setSortField] = useState<SortField>("days");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [kickoffLead, setKickoffLead] = useState<Lead | null>(null);
  // A lead object pre-fills the builder from that lead; "standalone" opens
  // it with no lead yet (e.g. a client calling in directly) -- the builder
  // itself creates the lead as part of submitting.
  const [quoteTarget, setQuoteTarget] = useState<Lead | "standalone" | null>(null);
  // Keyed by lead id so the Download PDF link is available directly on
  // every row that has a quote -- not just as a one-time toast right after
  // creating it -- and always points at the current (latest-generated)
  // revision, since the PDF route itself regenerates from live data.
  const [quotesByLeadId, setQuotesByLeadId] = useState(initialQuotesByLeadId);

  function upsertLead(lead: Lead) {
    setLeads((prev) => [lead, ...prev]);
  }

  function handleSourceCreated(source: ReferralSource) {
    setReferralSources((prev) => [...prev, source].sort((a, b) => a.name.localeCompare(b.name)));
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
        <h2 className="text-lg font-normal">Quotes &amp; Leads</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Intake, Follow-Up &amp; Quote Building</span>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-xs uppercase tracking-wide text-ink/60">New Lead</h3>
          {canBuildQuotes(role) && (
            <button
              onClick={() => setQuoteTarget("standalone")}
              className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas"
            >
              Build Quote — Client Calling In
            </button>
          )}
        </div>
        <LeadIntakeForm referralSources={referralSources} onAdded={upsertLead} onSourceCreated={handleSourceCreated} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 font-mono text-xs uppercase tracking-wide text-ink/60">Leads</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="active">Active (excludes Signed/Lost/Not Materialized)</option>
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
                  <th className="px-3 py-2" />
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
                        <td className="max-w-[160px] px-3 py-2 text-ink/70">
                          {lead.scopeTags.length > 0 ? lead.scopeTags.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-ink/70">
                          {lead.budgetRange && <div>{lead.budgetRange}</div>}
                          {formatTimelineRange(lead.timelineStartMonth, lead.timelineEndMonth) && (
                            <div>{formatTimelineRange(lead.timelineStartMonth, lead.timelineEndMonth)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-ink/70">{lead.referralSourceName ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase ${s.className}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${s.label}`}>{days}d ago</td>
                        <td className="px-3 py-2 text-right">
                          {quotesByLeadId[lead.id] && (
                            <a
                              href={`/api/quotes/${quotesByLeadId[lead.id]}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-block whitespace-nowrap border border-ink px-2.5 py-1 font-mono text-[10px] uppercase text-ink hover:bg-canvas"
                            >
                              Download PDF
                            </a>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${lead.id}-edit`} className="border-b border-line bg-canvas">
                          <td colSpan={9} className="p-4">
                            <LeadEditPanel
                              lead={lead}
                              referralSources={referralSources}
                              onPatch={(patch) => patchLead(lead.id, patch)}
                              onMarkContacted={() => markContacted(lead.id)}
                              onSignedContractRequested={() => setKickoffLead(lead)}
                              onSourceCreated={handleSourceCreated}
                              canBuildQuote={canBuildQuotes(role)}
                              onBuildQuoteRequested={() => setQuoteTarget(lead)}
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

      {kickoffLead && (
        <ProjectKickoffPanel
          lead={kickoffLead}
          milestoneTemplates={milestoneTemplates}
          clients={clients}
          onClose={() => setKickoffLead(null)}
          onCreated={(projectId) => {
            patchLead(kickoffLead.id, { status: "Signed Contract", convertedProjectId: projectId });
            setKickoffLead(null);
          }}
        />
      )}

      {quoteTarget && (
        <QuoteBuilderPanel
          lead={quoteTarget === "standalone" ? null : quoteTarget}
          selectionCatalog={selectionCatalog}
          referralSources={referralSources}
          clients={clients}
          onClose={() => setQuoteTarget(null)}
          onCreated={({ lead: resultLead, quoteId }) => {
            if (leads.some((l) => l.id === resultLead.id)) {
              patchLead(resultLead.id, resultLead);
            } else {
              upsertLead(resultLead);
            }
            setQuotesByLeadId((prev) => ({ ...prev, [resultLead.id]: quoteId }));
            setQuoteTarget(null);
          }}
        />
      )}
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

export function ScopePills({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
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

export function ReferralSourceSelect({
  referralSources,
  value,
  onChange,
  onSourceCreated,
}: {
  referralSources: ReferralSource[];
  value: string;
  onChange: (id: string, name: string | null) => void;
  onSourceCreated: (source: ReferralSource) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<(typeof REFERRAL_TYPES)[number]>("Other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setError("");
    const name = newName.trim();
    if (!name) return setError("Enter a name.");

    setSaving(true);
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("referral_sources")
      .insert({ name, type: newType })
      .select("id, name, type")
      .single();
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSourceCreated(data);
    onChange(data.id, data.name);
    setAdding(false);
    setNewName("");
    setNewType("Other");
  }

  if (adding) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New source name"
          className="w-32 border border-line px-2 py-1.5 text-xs"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as (typeof REFERRAL_TYPES)[number])}
          className="border border-line px-1 py-1.5 text-xs"
        >
          {REFERRAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={create}
          disabled={saving}
          className="bg-brand-primary px-2 py-1.5 font-mono text-[10px] uppercase text-white disabled:opacity-50"
        >
          {saving ? "…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setError("");
          }}
          className="font-mono text-[10px] uppercase text-ink/50 underline underline-offset-2"
        >
          Cancel
        </button>
        {error && <span className="w-full text-[10px] text-warning">{error}</span>}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === NEW_SOURCE_SENTINEL) {
          setAdding(true);
          return;
        }
        const source = referralSources.find((r) => r.id === e.target.value);
        onChange(e.target.value, source?.name ?? null);
      }}
      className="w-full border border-line px-2 py-1.5 text-xs"
    >
      <option value="">—</option>
      <option value={NEW_SOURCE_SENTINEL}>+ New Source</option>
      {referralSources.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

function LeadIntakeForm({
  referralSources,
  onAdded,
  onSourceCreated,
}: {
  referralSources: ReferralSource[];
  onAdded: (lead: Lead) => void;
  onSourceCreated: (source: ReferralSource) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState("");
  const [scopeTags, setScopeTags] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [timelineStart, setTimelineStart] = useState("");
  const [timelineEnd, setTimelineEnd] = useState("");
  const [referralSourceId, setReferralSourceId] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<(typeof REFERRAL_TYPES)[number]>("Other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  const isNewSource = referralSourceId === NEW_SOURCE_SENTINEL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSavedMessage(false);
    if (!name.trim()) return setError("Name is required.");
    if (isNewSource && !newSourceName.trim()) return setError("Enter a name for the new referral source.");
    if (!isValidBudgetRange(budgetRange)) return setError('Budget should be a dollar amount or range, e.g. "$10k–$20k".');
    if (!isValidEmail(email)) return setError("Enter a valid email address.");
    if (!isValidPhone(phone)) return setError("Enter a valid phone number.");

    setSaving(true);
    const supabase = createClient();

    let finalReferralSourceId = isNewSource ? null : referralSourceId || null;
    let finalReferralSourceName: string | null = null;

    if (isNewSource) {
      const { data: sourceData, error: sourceError } = await supabase
        .from("referral_sources")
        .insert({ name: newSourceName.trim(), type: newSourceType })
        .select("id, name, type")
        .single();
      if (sourceError) {
        setSaving(false);
        setError(sourceError.message);
        return;
      }
      onSourceCreated(sourceData);
      finalReferralSourceId = sourceData.id;
      finalReferralSourceName = sourceData.name;
    } else {
      finalReferralSourceName = referralSources.find((r) => r.id === referralSourceId)?.name ?? null;
    }

    const timelineStartMonth = monthInputToDate(timelineStart);
    const timelineEndMonth = monthInputToDate(timelineEnd);

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
        timeline_start_month: timelineStartMonth,
        timeline_end_month: timelineEndMonth,
        referral_source_id: finalReferralSourceId,
        notes: notes.trim() || null,
      })
      .select("id, created_at")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    onAdded({
      id: data.id,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      projectType: projectType || null,
      scopeTags,
      state: state.trim() || null,
      budgetRange: budgetRange.trim() || null,
      timelineStartMonth,
      timelineEndMonth,
      referralSourceId: finalReferralSourceId,
      referralSourceName: finalReferralSourceName,
      notes: notes.trim() || null,
      status: "New Prospect",
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
    setTimelineStart("");
    setTimelineEnd("");
    setReferralSourceId("");
    setNewSourceName("");
    setNewSourceType("Other");
    setNotes("");

    setSavedMessage(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedMessage(false), 3000);
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
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Tentative Timeline</label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-7 flex-shrink-0 text-[10px] text-ink/40">From</span>
            <input
              type="month"
              value={timelineStart}
              onChange={(e) => setTimelineStart(e.target.value)}
              className="w-full border border-line px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-7 flex-shrink-0 text-[10px] text-ink/40">To</span>
            <input
              type="month"
              value={timelineEnd}
              onChange={(e) => setTimelineEnd(e.target.value)}
              className="w-full border border-line px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Referral Source</label>
        <select
          value={referralSourceId}
          onChange={(e) => setReferralSourceId(e.target.value)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          <option value="">—</option>
          <option value={NEW_SOURCE_SENTINEL}>+ New Source</option>
          {referralSources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {isNewSource && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              autoFocus
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="New source name"
              className="w-full border border-line px-2 py-1.5 text-xs"
            />
            <select
              value={newSourceType}
              onChange={(e) => setNewSourceType(e.target.value as (typeof REFERRAL_TYPES)[number])}
              className="border border-line px-1 py-1.5 text-xs"
            >
              {REFERRAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
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
        {savedMessage && <span className="ml-3 text-xs text-positive">✓ Lead saved</span>}
      </div>
    </form>
  );
}

function LeadEditPanel({
  lead,
  referralSources,
  onPatch,
  onMarkContacted,
  onSignedContractRequested,
  onSourceCreated,
  canBuildQuote,
  onBuildQuoteRequested,
}: {
  lead: Lead;
  referralSources: ReferralSource[];
  onPatch: (patch: Partial<Lead>) => void;
  onMarkContacted: () => void;
  onSignedContractRequested: () => void;
  onSourceCreated: (source: ReferralSource) => void;
  canBuildQuote: boolean;
  onBuildQuoteRequested: () => void;
}) {
  const [statusError, setStatusError] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  async function update(column: string, value: string | string[] | null, patch: Partial<Lead>) {
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ [column]: value }).eq("id", lead.id);
    if (!error) onPatch(patch);
  }

  // Quote Sent / Lost / Business Not Materialized keep the separate "Business
  // Not Materialized" tab (sow_sent-backed) in sync without merging the two
  // systems: a quote going out or falling through updates or creates the
  // linked sow_sent row alongside the lead's own status.
  async function handleStatusChange(newStatus: LeadStatus) {
    if (newStatus === "Signed Contract") {
      onSignedContractRequested();
      return;
    }

    setStatusError("");
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
    if (error) {
      setStatusError(error.message);
      return;
    }
    onPatch({ status: newStatus });

    if (newStatus === "Quote Sent" && !lead.convertedSowId) {
      const { data, error: sowError } = await supabase
        .from("sow_sent")
        .insert({ date_sent: toIsoDate(new Date()), prospect_name: lead.name, notes: lead.notes, status: "Open" })
        .select("id")
        .single();
      if (!sowError) {
        await supabase.from("leads").update({ converted_sow_id: data.id }).eq("id", lead.id);
        onPatch({ convertedSowId: data.id });
      }
    } else if (newStatus === "Lost" && lead.convertedSowId) {
      await supabase.from("sow_sent").update({ status: "Declined" }).eq("id", lead.convertedSowId);
    } else if (newStatus === "Business Not Materialized") {
      if (lead.convertedSowId) {
        await supabase.from("sow_sent").update({ status: "Declined" }).eq("id", lead.convertedSowId);
      } else {
        const { data, error: sowError } = await supabase
          .from("sow_sent")
          .insert({
            date_sent: toIsoDate(new Date()),
            prospect_name: lead.name,
            notes: lead.notes,
            status: "Declined",
          })
          .select("id")
          .single();
        if (!sowError) {
          await supabase.from("leads").update({ converted_sow_id: data.id }).eq("id", lead.id);
          onPatch({ convertedSowId: data.id });
        }
      }
    }
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
          onBlur={(e) => {
            if (!isValidEmail(e.target.value)) {
              setEmailError("Enter a valid email address.");
              e.target.value = lead.email ?? "";
              return;
            }
            setEmailError("");
            update("email", e.target.value || null, { email: e.target.value || null });
          }}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
        {emailError && <span className="mt-1 block text-[10px] text-warning">{emailError}</span>}
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Phone</label>
        <input
          defaultValue={lead.phone ?? ""}
          onBlur={(e) => {
            if (!isValidPhone(e.target.value)) {
              setPhoneError("Enter a valid phone number.");
              e.target.value = lead.phone ?? "";
              return;
            }
            setPhoneError("");
            update("phone", e.target.value || null, { phone: e.target.value || null });
          }}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
        {phoneError && <span className="mt-1 block text-[10px] text-warning">{phoneError}</span>}
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
          onBlur={(e) => {
            if (!isValidBudgetRange(e.target.value)) {
              setBudgetError('Should be a dollar amount or range, e.g. "$10k–$20k".');
              e.target.value = lead.budgetRange ?? "";
              return;
            }
            setBudgetError("");
            update("budget_range", e.target.value || null, { budgetRange: e.target.value || null });
          }}
          className="w-full border border-line px-2 py-1.5 text-xs"
        />
        {budgetError && <span className="mt-1 block text-[10px] text-warning">{budgetError}</span>}
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Tentative Timeline</label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-7 flex-shrink-0 text-[10px] text-ink/40">From</span>
            <input
              type="month"
              defaultValue={monthInputValue(lead.timelineStartMonth)}
              onBlur={(e) => {
                const date = monthInputToDate(e.target.value);
                update("timeline_start_month", date, { timelineStartMonth: date });
              }}
              className="w-full border border-line px-2 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-7 flex-shrink-0 text-[10px] text-ink/40">To</span>
            <input
              type="month"
              defaultValue={monthInputValue(lead.timelineEndMonth)}
              onBlur={(e) => {
                const date = monthInputToDate(e.target.value);
                update("timeline_end_month", date, { timelineEndMonth: date });
              }}
              className="w-full border border-line px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Referral Source</label>
        <ReferralSourceSelect
          referralSources={referralSources}
          value={lead.referralSourceId ?? ""}
          onChange={(id, name) =>
            update("referral_source_id", id || null, { referralSourceId: id || null, referralSourceName: name })
          }
          onSourceCreated={onSourceCreated}
        />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Status</label>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          className="w-full border border-line px-2 py-1.5 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {statusError && <span className="mt-1 block text-[10px] text-warning">{statusError}</span>}
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
        {canBuildQuote && (
          <button
            onClick={onBuildQuoteRequested}
            className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas"
          >
            Build Quote
          </button>
        )}
        {lead.lastContactedDate && (
          <span className="ml-auto font-mono text-[10px] text-ink/40">Last contacted {lead.lastContactedDate}</span>
        )}
      </div>
    </div>
  );
}
