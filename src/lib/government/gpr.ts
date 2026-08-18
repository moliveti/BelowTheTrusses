/**
 * Georgia Procurement Registry (GPR) — the state's own public bid search
 * system. No documented API, but its search page calls a plain JSON
 * endpoint (POST /gpr/eventSearch, DataTables server-side-processing
 * format) with no login and no API key. Verified by hand against the live
 * site: https://ssl.doas.state.ga.us/gpr/.
 */

import type { RawOpportunity } from "./types";

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

async function getGprSessionCookie(): Promise<string> {
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

function gprDetailUrl(esourceNumber: string): string {
  return `https://ssl.doas.state.ga.us/gpr/eventDetails?eSourceNumber=${encodeURIComponent(esourceNumber)}&sourceSystemType=gpr20`;
}

/** Fetches and dedupes GPR's currently-Open events across every keyword. */
export async function fetchGprOpportunities(keywords: string[]): Promise<RawOpportunity[]> {
  const sessionCookie = await getGprSessionCookie();
  const seenByExternalId = new Map<string, GprEvent>();
  for (const keyword of keywords) {
    const events = await searchGpr(keyword, sessionCookie);
    for (const e of events) seenByExternalId.set(e.esourceNumber, e);
  }
  return Array.from(seenByExternalId.values()).map((e) => ({
    externalId: e.esourceNumber,
    title: e.title,
    agencyName: e.agencyName,
    governmentType: e.governmentType,
    status: e.status,
    postingDate: e.postingDate,
    closingDate: e.closingDate,
    detailUrl: gprDetailUrl(e.esourceNumber),
  }));
}
