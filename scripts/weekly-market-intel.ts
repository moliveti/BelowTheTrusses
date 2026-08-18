/**
 * Weekly Market Intelligence Update — the single Monday-morning
 * orchestration run that replaces the old GA-only Mon/Wed/Fri schedule.
 *
 * Sector 1 (Opportunity Radar): refreshes government_opportunities from
 * the two official state bid registries (GA/GPR, FL/MFMP) — deterministic,
 * free, no AI involved. Every row gets a fit_score so junk keyword matches
 * (a telecom "Architecture" listing, a sidewalk RFQ) can be ranked low
 * instead of appearing indiscriminately.
 *
 * Sectors 2 & 3 (Commercial BD Targets, Public-Sector/Institutional
 * Pipeline): no structured registry exists for these, so they're
 * discovered via Tavily web search against a curated query matrix, scored,
 * and only the finalists get sent through a batched Claude extraction call.
 * See src/lib/government/discovery.ts for the full pipeline.
 *
 * Runs inside .github/workflows/weekly-market-intel.yml, Mondays 8am ET.
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (existing),
 * plus TAVILY_API_KEY and ANTHROPIC_API_KEY (new/reused).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchGprOpportunities } from "../src/lib/government/gpr";
import { fetchMfmpOpportunities } from "../src/lib/government/mfmp";
import { computeFitScore } from "../src/lib/government/scoring";
import { discoverLeads, type LeadSector, type LeadState } from "../src/lib/government/discovery";
import type { RawOpportunity } from "../src/lib/government/types";

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}`);
    process.exit(1);
  }
  return v;
}

type Category = "interior_design_architecture" | "furniture_acquisition";
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  interior_design_architecture: ["interior design", "architect", "architectural", "design services"],
  furniture_acquisition: ["furniture", "furnishings", "FF&E"],
};

// Rough, transparent estimate — not exact billing. Search: Tavily's
// published rate is ~$0.005-0.008/request depending on plan; rounded up
// for headroom. AI: one batched extraction call per sector/state, a few
// thousand tokens each way on claude-opus-5 low-effort.
const EST_COST_PER_SEARCH = 0.01;
const EST_COST_PER_AI_CALL = 0.05;

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun..1=Mon..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function refreshOpportunities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  source: "ga_gpr" | "fl_mfmp",
  fetcher: (keywords: string[]) => Promise<RawOpportunity[]>
) {
  const now = new Date().toISOString();
  let total = 0;

  for (const category of Object.keys(CATEGORY_KEYWORDS) as Category[]) {
    const raw = await fetcher(CATEGORY_KEYWORDS[category]);

    const rows = raw.map((o) => ({
      source,
      external_id: o.externalId,
      category,
      title: o.title,
      agency_name: o.agencyName,
      government_type: o.governmentType,
      status: o.status,
      posting_date: o.postingDate,
      closing_date: o.closingDate,
      detail_url: o.detailUrl,
      fit_score: computeFitScore(o.title),
      last_seen_at: now,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("government_opportunities")
        .upsert(rows, { onConflict: "source,external_id,category" });
      if (error) throw new Error(`upsert failed for ${source}/${category}: ${error.message}`);
      total += rows.length;
    }

    // Anything previously Open in this source/category that didn't turn up
    // this run has closed/been awarded/cancelled since — mirrors the
    // reconciliation pass in the intelligence layer.
    const currentIds = raw.map((o) => o.externalId);
    const { error: staleError } = await supabase
      .from("government_opportunities")
      .update({ status: "Closed", last_seen_at: now })
      .eq("source", source)
      .eq("category", category)
      .eq("status", "Open")
      .not("external_id", "in", `(${currentIds.map((id) => `"${id}"`).join(",") || '""'})`);
    if (staleError) throw new Error(`stale reconciliation failed for ${source}/${category}: ${staleError.message}`);

    console.log(`${source}/${category}: ${rows.length} open opportunities`);
  }

  return total;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const weekOf = mondayOf(new Date());
  const usage = { searchRequests: 0, aiSummaryCalls: 0 };

  const { error: runInsertError } = await supabase
    .from("market_intel_runs")
    .upsert({ week_of: weekOf, status: "running" }, { onConflict: "week_of" });
  if (runInsertError) throw new Error(`run row insert failed: ${runInsertError.message}`);

  try {
    console.log("Refreshing GA (GPR)...");
    const gaCount = await refreshOpportunities(supabase, "ga_gpr", fetchGprOpportunities);

    console.log("Refreshing FL (MFMP)...");
    const flCount = await refreshOpportunities(supabase, "fl_mfmp", fetchMfmpOpportunities);

    console.log(`Opportunity Radar: ${gaCount + flCount} total open bids refreshed.`);

    const sectors: LeadSector[] = ["commercial_bd_target", "institutional_pipeline"];
    const states: LeadState[] = ["GA", "FL"];
    let totalLeads = 0;

    for (const state of states) {
      for (const sector of sectors) {
        console.log(`Discovering ${sector} leads for ${state}...`);
        const leads = await discoverLeads(sector, state, usage);
        if (leads.length > 0) {
          const { error } = await supabase.from("market_intel_leads").insert(
            leads.map((l) => ({
              sector,
              state,
              title: l.title,
              description: l.description,
              organizations: l.organizations,
              estimated_value: l.estimatedValue,
              location: l.location,
              why_btt_fits: l.whyBttFits,
              source_url: l.sourceUrl,
              fit_score: l.fitScore,
              week_of: weekOf,
            }))
          );
          if (error) throw new Error(`market_intel_leads insert failed for ${state}/${sector}: ${error.message}`);
        }
        totalLeads += leads.length;
        console.log(`${state}/${sector}: ${leads.length} leads found`);
      }
    }

    const estimatedCost = usage.searchRequests * EST_COST_PER_SEARCH + usage.aiSummaryCalls * EST_COST_PER_AI_CALL;

    await supabase
      .from("market_intel_runs")
      .update({
        status: "completed",
        search_requests: usage.searchRequests,
        ai_summary_calls: usage.aiSummaryCalls,
        estimated_cost_usd: Math.round(estimatedCost * 100) / 100,
      })
      .eq("week_of", weekOf);

    console.log(
      `Done. ${gaCount + flCount} bids, ${totalLeads} leads. ${usage.searchRequests} searches, ${usage.aiSummaryCalls} AI calls, ~$${estimatedCost.toFixed(2)}.`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("market_intel_runs")
      .update({ status: "failed", error_summary: message.slice(0, 2000) })
      .eq("week_of", weekOf);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
