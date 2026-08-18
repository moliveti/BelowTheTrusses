"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GovernmentOpportunity, LeadSector, MarketIntelLead, PursuitStatus } from "@/lib/government/types";

const PURSUIT_STATUSES: PursuitStatus[] = ["watching", "pursuing", "submitted", "declined", "lost", "won"];
const PURSUIT_LABEL: Record<PursuitStatus, string> = {
  watching: "Watching",
  pursuing: "Pursuing",
  submitted: "Submitted",
  declined: "Declined",
  lost: "Lost",
  won: "Won",
};

const DEFAULT_SHOWN = 5;

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  return Math.ceil((new Date(`${dateIso}T00:00:00Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function StateTag({ state }: { state: "GA" | "FL" }) {
  return <span className="border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-ink/50">{state}</span>;
}

function ViewAllToggle({ expanded, onToggle, hiddenCount }: { expanded: boolean; onToggle: () => void; hiddenCount: number }) {
  if (hiddenCount <= 0) return null;
  return (
    <button
      onClick={onToggle}
      className="mt-2 font-mono text-[10px] uppercase tracking-wide text-brand-primary underline underline-offset-2"
    >
      {expanded ? "Show Top Picks Only" : `View All Candidates (${hiddenCount} more)`}
    </button>
  );
}

function OpportunityRow({ opp, onChanged }: { opp: GovernmentOpportunity; onChanged: (id: string, status: PursuitStatus) => void }) {
  const [busy, setBusy] = useState(false);
  const days = daysUntil(opp.closingDate);
  const urgent = days !== null && days <= 5;

  async function setPursuitStatus(status: PursuitStatus) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("government_pursuits")
      .upsert({ opportunity_id: opp.id, status }, { onConflict: "opportunity_id" });
    setBusy(false);
    if (!error) onChanged(opp.id, status);
  }

  return (
    <div className={`border border-line border-l-4 bg-surface p-3 ${urgent ? "border-l-warning" : "border-l-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <StateTag state={opp.state} />
            <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink/40">
              {opp.fitScore !== null ? `Fit ${opp.fitScore}` : ""}
            </span>
          </div>
          <a href={opp.detailUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] text-brand-primary underline underline-offset-2">
            {opp.title}
          </a>
          <p className="mt-1 text-xs text-ink/60">
            {opp.agencyName}
            {days !== null && <span className={urgent ? "ml-2 text-warning" : "ml-2 text-ink/50"}>· closes in {days} day{days === 1 ? "" : "s"}</span>}
          </p>
        </div>
        <select
          value={opp.pursuitStatus ?? "watching"}
          disabled={busy}
          onChange={(e) => setPursuitStatus(e.target.value as PursuitStatus)}
          className="border border-line bg-canvas px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink/70 disabled:opacity-50"
        >
          {PURSUIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PURSUIT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: MarketIntelLead }) {
  return (
    <div className="border border-line border-l-4 border-l-line bg-surface p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <StateTag state={lead.state} />
        <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink/40">Fit {lead.fitScore}</span>
        {lead.estimatedValue !== null && (
          <span className="font-mono text-[9.5px] uppercase tracking-wide text-ink/40">
            · ${lead.estimatedValue.toLocaleString()}
          </span>
        )}
      </div>
      <a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] text-brand-primary underline underline-offset-2">
        {lead.title}
      </a>
      {lead.description && <p className="mt-1 text-xs text-ink/70">{lead.description}</p>}
      {lead.organizations.length > 0 && (
        <p className="mt-1 text-[11px] text-ink/50">
          {lead.organizations.map((o) => `${o.name} (${o.role})`).join(" · ")}
        </p>
      )}
      {lead.location && <p className="mt-0.5 text-[11px] text-ink/40">{lead.location}</p>}
      {lead.whyBttFits && <p className="mt-1.5 text-xs text-positive">{lead.whyBttFits}</p>}
    </div>
  );
}

function OpportunityRadarSection({ opportunities }: { opportunities: GovernmentOpportunity[] }) {
  const [rows, setRows] = useState(opportunities);
  const [expanded, setExpanded] = useState(false);

  function onChanged(id: string, status: PursuitStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, pursuitStatus: status } : r)));
  }

  const shown = expanded ? rows : rows.slice(0, DEFAULT_SHOWN);

  return (
    <section className="mb-8">
      <h4 className="mb-1 font-mono text-xs uppercase tracking-wide text-ink/60">Opportunity Radar — Pursue Now</h4>
      <p className="mb-3 text-[11px] text-ink/50">Active government bids you can quote or qualify for now (GA + FL).</p>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">No open opportunities right now — check back after the next refresh.</p>
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((opp) => (
              <OpportunityRow key={opp.id} opp={opp} onChanged={onChanged} />
            ))}
          </div>
          <ViewAllToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} hiddenCount={rows.length - DEFAULT_SHOWN} />
        </>
      )}
    </section>
  );
}

function LeadSectorSection({ title, subtitle, leads }: { title: string; subtitle: string; leads: MarketIntelLead[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? leads : leads.slice(0, DEFAULT_SHOWN);

  return (
    <section className="mb-8">
      <h4 className="mb-1 font-mono text-xs uppercase tracking-wide text-ink/60">{title}</h4>
      <p className="mb-3 text-[11px] text-ink/50">{subtitle}</p>
      {leads.length === 0 ? (
        <p className="text-sm text-ink/50">Nothing surfaced this week.</p>
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
          <ViewAllToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} hiddenCount={leads.length - DEFAULT_SHOWN} />
        </>
      )}
    </section>
  );
}

function bySector(leads: MarketIntelLead[], sector: LeadSector): MarketIntelLead[] {
  return leads.filter((l) => l.sector === sector);
}

export function MarketIntelSection({
  opportunities,
  leads,
  updatedAt,
}: {
  opportunities: GovernmentOpportunity[];
  leads: MarketIntelLead[];
  updatedAt: string | null;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Weekly Market Intelligence Update</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">
          Florida + Georgia{updatedAt ? ` · Updated ${updatedAt}` : ""}
        </span>
      </div>

      <OpportunityRadarSection opportunities={opportunities} />
      <LeadSectorSection
        title="Commercial Business-Development Targets"
        subtitle="Projects and organizations to proactively approach."
        leads={bySector(leads, "commercial_bd_target")}
      />
      <LeadSectorSection
        title="Public-Sector / Institutional Pipeline"
        subtitle="Early-stage public and institutional opportunities worth developing before the bid arrives."
        leads={bySector(leads, "institutional_pipeline")}
      />
    </section>
  );
}
