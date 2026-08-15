/**
 * Pulls current bid opportunities from the Georgia Procurement Registry
 * (GPR) — the state's own public bid search system — and upserts the ones
 * matching our two categories (interior design/architecture, furniture
 * acquisition) into `government_opportunities`.
 *
 * GPR has no documented public API, but its search page calls a plain
 * JSON endpoint (POST /gpr/eventSearch, DataTables server-side-processing
 * format) with no login and no API key. Verified by hand against the live
 * site: https://ssl.doas.state.ga.us/gpr/. This script replicates that
 * same request per keyword.
 *
 * Runs inside .github/workflows/ga-opportunities.yml on a schedule and via
 * workflow_dispatch for manual runs. Requires only the same two secrets
 * the backup pipeline already uses (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY) — nothing new to provision.
 */

import { createClient } from "@supabase/supabase-js";

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

// Curated, not exhaustive — free-text keyword search against GPR's own
// title/ID field. Expect to tune this list over time as false positives/
// negatives turn up; it's not meant to be a precise taxonomy, just a
// reasonable net for a human to then triage in the UI.
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  interior_design_architecture: ["interior design", "architect", "architectural", "design services"],
  furniture_acquisition: ["furniture", "furnishings", "FF&E"],
};

const GPR_BASE_URL = "https://ssl.doas.state.ga.us/gpr/";
const GPR_SEARCH_URL = "https://ssl.doas.state.ga.us/gpr/eventSearch";

// GPR redirects requests with an unrecognized User-Agent to a "browser not
// supported" page instead of the real app (and its session cookie isn't
// issued until you land on the real page) — a plain server-side fetch needs
// to look like an actual browser to get past that gate.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface GprEvent {
  esourceNumber: string;
  title: string;
  agencyName: string;
  governmentType: string | null;
  status: string;
  postingDate: string | null; // YYYY-MM-DD
  closingDate: string | null; // YYYY-MM-DD
}

// The site's own DataTables column definitions — GPR's server-side
// processing endpoint 400s on an incomplete/mismatched column list, so this
// mirrors exactly what the live search page itself sends (captured by
// instrumenting a real search in a browser against ssl.doas.state.ga.us).
const DATATABLES_COLUMNS = [
  { data: "function", searchable: true, orderable: false },
  { data: "function", searchable: true, orderable: true },
  { data: "title", searchable: true, orderable: true },
  { data: "agencyName", searchable: true, orderable: true },
  { data: "function", searchable: true, orderable: true },
  { data: "function", searchable: true, orderable: true },
  { data: "function", searchable: true, orderable: false },
  { data: "status", searchable: true, orderable: false },
];

async function getSessionCookie(): Promise<string> {
  const res = await fetch(GPR_BASE_URL, { headers: { "User-Agent": BROWSER_USER_AGENT } });
  if (!res.ok) throw new Error(`GPR session fetch failed: ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const jsessionId = setCookie.find((c) => c.startsWith("JSESSIONID="));
  if (!jsessionId) throw new Error("GPR did not issue a session cookie — page structure may have changed");
  return jsessionId.split(";")[0];
}

async function searchGpr(keyword: string, sessionCookie: string): Promise<GprEvent[]> {
  const body = new URLSearchParams({ draw: "1" });
  DATATABLES_COLUMNS.forEach((col, i) => {
    body.set(`columns[${i}][data]`, col.data);
    body.set(`columns[${i}][name]`, "");
    body.set(`columns[${i}][searchable]`, String(col.searchable));
    body.set(`columns[${i}][orderable]`, String(col.orderable));
    body.set(`columns[${i}][search][value]`, "");
    body.set(`columns[${i}][search][regex]`, "false");
  });
  body.set("order[0][column]", "5");
  body.set("order[0][dir]", "asc");
  body.set("start", "0");
  body.set("length", "100");
  body.set("search[value]", "");
  body.set("search[regex]", "false");
  body.set("responseType", "ALL");
  body.set("eventStatus", "OPEN");
  body.set("eventIdTitle", keyword);
  body.set("govType", "ALL");
  body.set("govEntity", "");
  body.set("catType", "ALL");
  body.set("eventProcessType", "ALL");
  body.set("dateRangeType", "");
  body.set("rangeStartDate", "");
  body.set("rangeEndDate", "");
  body.set("isReset", "false");
  body.set("persisted", "false");
  body.set("refreshSearchData", "true");

  const res = await fetch(GPR_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": BROWSER_USER_AGENT,
      Cookie: sessionCookie,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`GPR search failed for "${keyword}": ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`GPR search for "${keyword}" returned non-JSON (session likely rejected) — GPR's site structure may have changed`);
  }
  const json = await res.json();
  return (json.data ?? []) as GprEvent[];
}

function detailUrl(esourceNumber: string): string {
  return `https://ssl.doas.state.ga.us/gpr/eventDetails?eSourceNumber=${encodeURIComponent(esourceNumber)}&sourceSystemType=gpr20`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();
  let totalUpserted = 0;
  const sessionCookie = await getSessionCookie();

  for (const category of Object.keys(CATEGORY_KEYWORDS) as Category[]) {
    const seenByExternalId = new Map<string, GprEvent>();
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      const events = await searchGpr(keyword, sessionCookie);
      for (const e of events) seenByExternalId.set(e.esourceNumber, e);
    }

    const rows = Array.from(seenByExternalId.values()).map((e) => ({
      source: "ga_gpr",
      external_id: e.esourceNumber,
      category,
      title: e.title,
      agency_name: e.agencyName,
      government_type: e.governmentType,
      status: e.status,
      posting_date: e.postingDate,
      closing_date: e.closingDate,
      detail_url: detailUrl(e.esourceNumber),
      last_seen_at: now,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("government_opportunities")
        .upsert(rows, { onConflict: "source,external_id,category" });
      if (error) throw new Error(`upsert failed for ${category}: ${error.message}`);
      totalUpserted += rows.length;
    }

    // Anything previously Open in this category that didn't turn up in this
    // run's OPEN search has closed, been awarded, or been cancelled since —
    // GPR no longer reports it as Open, so neither should we. Mirrors the
    // reconciliation pass in the intelligence layer (recommendations rows
    // no longer produced by a run get resolved, not left stale forever).
    const currentExternalIds = Array.from(seenByExternalId.keys());
    const { error: staleError } = await supabase
      .from("government_opportunities")
      .update({ status: "Closed", last_seen_at: now })
      .eq("category", category)
      .eq("status", "Open")
      .not("external_id", "in", `(${currentExternalIds.map((id) => `"${id}"`).join(",") || '""'})`);
    if (staleError) throw new Error(`stale reconciliation failed for ${category}: ${staleError.message}`);

    console.log(`${category}: ${rows.length} open opportunities found`);
  }

  console.log(`Done. ${totalUpserted} opportunities upserted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
