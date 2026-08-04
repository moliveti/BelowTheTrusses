"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus } from "@/lib/leads/types";
import type { ReferralSource } from "@/lib/dashboard/types";
import { toIsoDate } from "@/lib/hours/dates";

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const OPEN_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified"];
const STALE_DAYS = 7;

function daysSince(dateIso: string): number {
  const then = new Date(dateIso).getTime();
  const now = new Date().getTime();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function LeadsTab({
  leads: initialLeads,
  referralSources,
}: {
  leads: Lead[];
  referralSources: ReferralSource[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");

  const staleLeads = useMemo(
    () =>
      leads
        .filter((l) => OPEN_STATUSES.includes(l.status))
        .map((l) => ({ lead: l, days: daysSince(l.lastContactedDate ?? l.createdAt) }))
        .filter((x) => x.days >= STALE_DAYS)
        .sort((a, b) => b.days - a.days),
    [leads]
  );

  const filtered = leads.filter((l) => statusFilter === "all" || l.status === statusFilter);

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

  async function updateStatus(id: string, status: LeadStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (!error) patchLead(id, { status });
  }

  async function convertToSow(lead: Lead) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sow_sent")
      .insert({
        date_sent: toIsoDate(new Date()),
        prospect_name: lead.name,
        notes: lead.notes,
        status: "Open",
      })
      .select("id")
      .single();
    if (error) return;

    const { error: updateError } = await supabase
      .from("leads")
      .update({ status: "Converted", converted_sow_id: data.id })
      .eq("id", lead.id);
    if (!updateError) patchLead(lead.id, { status: "Converted", convertedSowId: data.id });
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Leads</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Intake &amp; Follow-Up</span>
      </div>

      <section className="mb-10">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Needs Follow-Up</h3>
        {staleLeads.length === 0 ? (
          <div className="border border-line bg-surface p-4 text-sm text-ink/50">
            Nothing stale — every open lead has been contacted in the last {STALE_DAYS} days.
          </div>
        ) : (
          <div className="border border-warning/40 bg-surface">
            {staleLeads.map(({ lead, days }) => (
              <div
                key={lead.id}
                className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-b-0"
              >
                <span className="font-medium">{lead.name}</span>
                <span className="font-mono text-[10px] uppercase text-ink/40">{lead.status}</span>
                <span className="font-mono text-xs text-warning">{days} days since last contact</span>
                <button
                  onClick={() => markContacted(lead.id)}
                  className="ml-auto bg-brand-primary px-3 py-1 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90"
                >
                  Mark Contacted Today
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">New Lead</h3>
        <LeadIntakeForm referralSources={referralSources} onAdded={upsertLead} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 font-mono text-xs uppercase tracking-wide text-ink/60">All Leads</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | LeadStatus)}
            className="border border-line px-2 py-1 text-xs"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <LeadsTable leads={filtered} onStatusChange={updateStatus} onConvert={convertToSow} />
      </section>
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
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Type</label>
        <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs">
          <option value="">—</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
          <option value="Furniture">Furniture</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">State</label>
        <input value={state} onChange={(e) => setState(e.target.value)} className="w-full border border-line px-2 py-1.5 text-xs" />
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-ink/60">Budget Range</label>
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
      <div className="col-span-2 sm:col-span-4">
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

function LeadsTable({
  leads,
  onStatusChange,
  onConvert,
}: {
  leads: Lead[];
  onStatusChange: (id: string, status: LeadStatus) => void;
  onConvert: (lead: Lead) => void;
}) {
  if (leads.length === 0) {
    return <div className="border border-line bg-surface p-4 text-sm text-ink/50">No leads yet.</div>;
  }

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[820px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Name</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Contact</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Type</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Budget / Timeline</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Referral</th>
            <th className="px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b border-line hover:bg-canvas">
              <td className="px-3 py-2">{l.name}</td>
              <td className="px-3 py-2 text-ink/70">
                {l.email && <div>{l.email}</div>}
                {l.phone && <div>{l.phone}</div>}
              </td>
              <td className="px-3 py-2">{l.projectType ?? "—"}</td>
              <td className="px-3 py-2 text-ink/70">
                {l.budgetRange && <div>{l.budgetRange}</div>}
                {l.timeline && <div>{l.timeline}</div>}
              </td>
              <td className="px-3 py-2 text-ink/70">{l.referralSourceName ?? "—"}</td>
              <td className="px-3 py-2">
                <select
                  value={l.status}
                  onChange={(e) => onStatusChange(l.id, e.target.value as LeadStatus)}
                  className="border border-line px-1.5 py-1 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-right">
                {!l.convertedSowId && l.status !== "Converted" && l.status !== "Lost" && (
                  <button
                    onClick={() => onConvert(l)}
                    className="font-mono text-[11px] text-brand-primary underline underline-offset-2"
                  >
                    Convert to SOW
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
