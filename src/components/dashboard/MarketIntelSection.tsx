"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GovernmentOpportunity, OpportunityCategory, PursuitStatus } from "@/lib/government/types";

const PURSUIT_STATUSES: PursuitStatus[] = ["watching", "pursuing", "submitted", "declined", "lost", "won"];
const PURSUIT_LABEL: Record<PursuitStatus, string> = {
  watching: "Watching",
  pursuing: "Pursuing",
  submitted: "Submitted",
  declined: "Declined",
  lost: "Lost",
  won: "Won",
};

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  return Math.ceil((new Date(`${dateIso}T00:00:00Z`).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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

function CategoryTag({ label }: { label: string }) {
  return (
    <span className="border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-ink/50">
      {label}
    </span>
  );
}

function GaPanel({ opportunities }: { opportunities: GovernmentOpportunity[] }) {
  const [rows, setRows] = useState(opportunities);

  function onChanged(id: string, status: PursuitStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, pursuitStatus: status } : r)));
  }

  const byCategory = (category: OpportunityCategory) => rows.filter((r) => r.category === category);
  const sections: { category: OpportunityCategory; label: string }[] = [
    { category: "interior_design_architecture", label: "Interior Design & Architecture" },
    { category: "furniture_acquisition", label: "Furniture Acquisition" },
  ];

  return (
    <div className="border border-line bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-[15px]">Georgia</h4>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Statewide · Government</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <CategoryTag label="Interior Design & Architecture" />
        <CategoryTag label="Furniture Acquisition" />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">No open opportunities right now — check back after the next refresh.</p>
      ) : (
        sections.map(({ category, label }) => {
          const items = byCategory(category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-4 last:mb-0">
              <h5 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">
                {label} ({items.length})
              </h5>
              <div className="space-y-2">
                {items.map((opp) => (
                  <OpportunityRow key={opp.id} opp={opp} onChanged={onChanged} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <p className="mt-3 text-[11px] text-ink/40">
        Sourced from the Georgia Procurement Registry; refreshed a few times a week. Keyword-matched, not a precise
        category — worth a quick skim for false positives.
      </p>
    </div>
  );
}

function FlPanel() {
  return (
    <div className="border border-line bg-surface p-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-[15px]">Florida</h4>
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Jacksonville Area</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <CategoryTag label="Government" />
        <CategoryTag label="Commercial" />
        <CategoryTag label="Residential" />
      </div>
      <p className="text-sm text-ink/50">
        Not connected — no free, structured public source was found for Jacksonville-area opportunities across these
        categories.
      </p>
    </div>
  );
}

export function MarketIntelSection({ gaOpportunities }: { gaOpportunities: GovernmentOpportunity[] }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Market Intelligence</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">New Opportunities to Bid</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GaPanel opportunities={gaOpportunities} />
        <FlPanel />
      </div>
    </section>
  );
}
