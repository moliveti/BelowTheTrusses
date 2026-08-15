import { createClient } from "@/lib/supabase/server";
import type { GovernmentOpportunity, PursuitStatus } from "./types";

/** Open GA opportunities across both categories, most-urgent (soonest closing) first. Populated by scripts/fetch-ga-opportunities.ts, not queried live here. */
export async function getGaOpportunities(): Promise<GovernmentOpportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("government_opportunities")
    .select("id, category, title, agency_name, government_type, status, posting_date, closing_date, detail_url, government_pursuits(status)")
    .eq("status", "Open")
    .order("closing_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`government_opportunities: ${error.message}`);

  return (data ?? []).map((r) => {
    const pursuit = Array.isArray(r.government_pursuits) ? r.government_pursuits[0] : r.government_pursuits;
    return {
      id: r.id,
      category: r.category,
      title: r.title,
      agencyName: r.agency_name,
      governmentType: r.government_type,
      status: r.status,
      postingDate: r.posting_date,
      closingDate: r.closing_date,
      detailUrl: r.detail_url,
      pursuitStatus: (pursuit?.status as PursuitStatus | undefined) ?? null,
    };
  });
}
