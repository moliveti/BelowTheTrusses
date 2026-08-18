/**
 * Deterministic BTT-relevance scoring — replaces binary keyword-match
 * inclusion (which let junk like a telecom "Architecture" listing or a
 * sidewalk RFQ through just because it matched a search keyword) with a
 * weighted score. Used for both government_opportunities (GA/FL bid
 * titles) and market_intel_leads (BD targets / institutional pipeline
 * descriptions) — same function, same tuning, one source of truth.
 *
 * Curated, not exhaustive. Expect to tune these lists over time as false
 * positives/negatives turn up in practice.
 */

interface WeightedTerm {
  term: string;
  weight: number;
}

const POSITIVE_TERMS: WeightedTerm[] = [
  { term: "furniture", weight: 25 },
  { term: "ff&e", weight: 25 },
  { term: "office furniture", weight: 20 },
  { term: "classroom furniture", weight: 20 },
  { term: "institutional furniture", weight: 20 },
  { term: "furniture installation", weight: 15 },
  { term: "furniture delivery", weight: 15 },
  { term: "furnishings", weight: 15 },
  { term: "interior renovation", weight: 20 },
  { term: "interior design", weight: 20 },
  { term: "interior fit", weight: 15 },
  { term: "workplace", weight: 10 },
  { term: "casework", weight: 15 },
  { term: "millwork", weight: 15 },
  { term: "space planning", weight: 15 },
  { term: "administration building", weight: 10 },
  { term: "school", weight: 8 },
  { term: "university", weight: 8 },
  { term: "library", weight: 8 },
  { term: "hotel", weight: 10 },
  { term: "amenity", weight: 10 },
  { term: "amenity space", weight: 12 },
  { term: "commercial office", weight: 10 },
  { term: "office buildout", weight: 15 },
  { term: "build-out", weight: 10 },
  { term: "adaptive reuse", weight: 10 },
  { term: "value engineering", weight: 12 },
];

const NEGATIVE_TERMS: WeightedTerm[] = [
  { term: "civil engineering", weight: -30 },
  { term: "roadway", weight: -30 },
  { term: "sidewalk", weight: -30 },
  { term: "drainage", weight: -25 },
  { term: "telecommunications", weight: -30 },
  { term: "trunking", weight: -30 },
  { term: "session border controller", weight: -30 },
  { term: "network", weight: -20 },
  { term: "server", weight: -20 },
  { term: "software", weight: -20 },
  { term: "cybersecurity", weight: -25 },
  { term: "utility", weight: -20 },
  { term: "utilities", weight: -20 },
  { term: "bridge", weight: -25 },
  { term: "surveying", weight: -25 },
  { term: "traffic engineering", weight: -30 },
  { term: "mechanical systems", weight: -15 },
  { term: "hvac", weight: -15 },
  { term: "landscape", weight: -15 },
  { term: "landscaping", weight: -15 },
  { term: "pavement", weight: -25 },
  { term: "water and sewer", weight: -25 },
  { term: "roofing", weight: -15 },
  { term: "fire alarm", weight: -20 },
  { term: "elevator", weight: -15 },
  { term: "janitorial", weight: -25 },
  { term: "pest control", weight: -25 },
  { term: "vehicle", weight: -20 },
  { term: "fleet", weight: -20 },
];

const NEUTRAL_BASELINE = 50;

/** Scores 0-100 from free text (a bid title, or a discovered lead's title+description). Neutral baseline of 50 when nothing matches either list. */
export function computeFitScore(text: string): number {
  const lower = text.toLowerCase();
  let score = NEUTRAL_BASELINE;
  for (const { term, weight } of POSITIVE_TERMS) {
    if (lower.includes(term)) score += weight;
  }
  for (const { term, weight } of NEGATIVE_TERMS) {
    if (lower.includes(term)) score += weight;
  }
  return Math.max(0, Math.min(100, score));
}

/** Below this, an item is discarded before ever reaching the UI — not just ranked low. */
export const FIT_SCORE_DISCARD_THRESHOLD = 35;
