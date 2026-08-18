/**
 * MyFloridaMarketPlace (MFMP) — Florida's state procurement system. No
 * documented public API, but its vendor search page calls a plain JSON
 * endpoint (POST /mfmp/pub/search/bids) with no login and no API key.
 * Verified by hand against the live site:
 * https://vendor.myfloridamarketplace.com/search/bids.
 *
 * Covers Florida state agencies, state colleges/universities, and school
 * boards — NOT city/county governments (Jacksonville, Orlando, Tampa, etc.
 * each run their own separate procurement systems, unresearched/unwired).
 *
 * MFMP's own status values are all-caps ("OPEN", "WITHDRAWN", "CLOSED"),
 * unlike GPR's Title Case ("Open", "Closed") — normalized to GPR's
 * convention below (via normalizeStatus) so government_opportunities.status
 * stays consistent across both sources and the shared "Open" filter in
 * queries.ts works for either. Confirmed against a real currently-open
 * MFMP bid, not guessed.
 */

import type { RawOpportunity } from "./types";

const MFMP_SEARCH_URL = "https://vendor.myfloridamarketplace.com/mfmp/pub/search/bids";

// GPR uses Title Case ("Open"), MFMP uses all-caps ("OPEN") — normalized to
// GPR's convention so government_opportunities.status is consistent
// regardless of source.
function normalizeStatus(status: string): string {
  const upper = status.toUpperCase();
  const known: Record<string, string> = { OPEN: "Open", CLOSED: "Closed", WITHDRAWN: "Withdrawn", CANCELLED: "Cancelled", CANCELED: "Cancelled", AWARDED: "Awarded" };
  return known[upper] ?? status;
}

interface MfmpBid {
  agencyAdNumber: string;
  title: string;
  openDate: string | null;
  closeDate: string | null;
  status: string;
  advertisementId: number;
  uniqueName: string;
  agency: string;
  organization?: { name?: string };
}

async function searchMfmp(keyword: string): Promise<MfmpBid[]> {
  // Without an explicit Accept header, MFMP's server falls back to serving
  // the Angular SPA's index.html shell instead of routing to the actual
  // JSON API — a plain server-side fetch needs to declare this explicitly,
  // unlike a real browser request which sends it automatically.
  const res = await fetch(MFMP_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      pageSize: 100,
      type: [],
      status: [],
      agency: [],
      adNumber: "",
      agencyAdvertisementNumber: "",
      title: keyword,
      publishedDate: "",
      openDate: "",
      endDate: null,
      commodityCodes: [],
      intendsToParticipate: "",
      assignee: "",
      page: 1,
    }),
  });
  if (!res.ok) throw new Error(`MFMP search failed for "${keyword}": ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`MFMP search for "${keyword}" returned non-JSON — site structure may have changed`);
  }
  return (await res.json()) as MfmpBid[];
}

function mfmpDetailUrl(advertisementId: number): string {
  return `https://vendor.myfloridamarketplace.com/search/bids/detail/${advertisementId}`;
}

function isStillOpen(bid: MfmpBid): boolean {
  if (bid.status.toUpperCase() !== "OPEN") return false;
  if (!bid.closeDate) return false;
  return new Date(bid.closeDate).getTime() > Date.now();
}

/** Fetches and dedupes MFMP's currently-open bids across every keyword. */
export async function fetchMfmpOpportunities(keywords: string[]): Promise<RawOpportunity[]> {
  const seenByExternalId = new Map<string, MfmpBid>();
  for (const keyword of keywords) {
    const bids = await searchMfmp(keyword);
    for (const b of bids) {
      if (isStillOpen(b)) seenByExternalId.set(b.uniqueName, b);
    }
  }
  return Array.from(seenByExternalId.values()).map((b) => ({
    externalId: b.uniqueName,
    title: b.title,
    agencyName: b.organization?.name ?? b.agency,
    governmentType: "state",
    status: normalizeStatus(b.status),
    postingDate: b.openDate ? b.openDate.slice(0, 10) : null,
    closingDate: b.closeDate ? b.closeDate.slice(0, 10) : null,
    detailUrl: mfmpDetailUrl(b.advertisementId),
  }));
}
