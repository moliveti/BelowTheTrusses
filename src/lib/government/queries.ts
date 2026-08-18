import { createClient } from "@/lib/supabase/server";
import type { GovernmentOpportunity, MarketIntelLead, MarketIntelRun, OpportunityState, PursuitStatus } from "./types";

function stateFromSource(source: string): OpportunityState {
  return source === "fl_mfmp" ? "FL" : "GA";
}

/** Open GA + FL opportunities across both categories, best-fit-score first. Populated by scripts/weekly-market-intel.ts. */
export async function getOpportunities(): Promise<GovernmentOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("government_opportunities")
    .select(
      "id, source, category, title, agency_name, government_type, status, posting_date, closing_date, detail_url, fit_score, government_pursuits(status)"
    )
    .eq("status", "Open")
    .order("fit_score", { ascending: false, nullsFirst: false })
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`government_opportunities: ${error.message}`);

  return (data ?? []).map((r) => {
    const pursuit = Array.isArray(r.government_pursuits) ? r.government_pursuits[0] : r.government_pursuits;
    return {
      id: r.id,
      state: stateFromSource(r.source),
      category: r.category,
      title: r.title,
      agencyName: r.agency_name,
      governmentType: r.government_type,
      status: r.status,
      postingDate: r.posting_date,
      closingDate: r.closing_date,
      detailUrl: r.detail_url,
      fitScore: r.fit_score,
      pursuitStatus: (pursuit?.status as PursuitStatus | undefined) ?? null,
    };
  });
}

/** Leads from the most recent completed weekly run only — not a running history. */
export async function getMarketIntelLeads(): Promise<MarketIntelLead[]> {
  const supabase = await createClient();
  const { data: latestRun } = await supabase
    .from("market_intel_runs")
    .select("week_of")
    .eq("status", "completed")
    .order("week_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestRun) return [];

  const { data, error } = await supabase
    .from("market_intel_leads")
    .select("id, sector, state, title, description, organizations, estimated_value, location, why_btt_fits, source_url, fit_score, week_of")
    .eq("week_of", latestRun.week_of)
    .order("fit_score", { ascending: false });
  if (error) throw new Error(`market_intel_leads: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    sector: r.sector,
    state: r.state,
    title: r.title,
    description: r.description,
    organizations: (r.organizations ?? []) as { name: string; role: string }[],
    estimatedValue: r.estimated_value,
    location: r.location,
    whyBttFits: r.why_btt_fits,
    sourceUrl: r.source_url,
    fitScore: r.fit_score,
    weekOf: r.week_of,
  }));
}

/** For the Admin cost-visibility panel. */
export async function getLatestMarketIntelRun(): Promise<MarketIntelRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_intel_runs")
    .select("week_of, search_requests, ai_summary_calls, estimated_cost_usd, status, error_summary")
    .order("week_of", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`market_intel_runs: ${error.message}`);
  if (!data) return null;

  return {
    weekOf: data.week_of,
    searchRequests: data.search_requests,
    aiSummaryCalls: data.ai_summary_calls,
    estimatedCostUsd: data.estimated_cost_usd,
    status: data.status,
    errorSummary: data.error_summary,
  };
}
