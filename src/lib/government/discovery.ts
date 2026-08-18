/**
 * Discovery pipeline for the two sectors with no structured registry to
 * query directly (commercial BD targets, institutional pipeline):
 * search → dedupe by URL → deterministic fit score → discard junk →
 * AI-extract structured fields only for the finalists that survive.
 *
 * Kept deliberately cheap: a tight, curated query matrix (not open-ended
 * exploration) and a single batched Claude call per sector/state for
 * extraction, not one call per candidate.
 */

import Anthropic from "@anthropic-ai/sdk";
import { tavilySearch, type TavilyResult } from "./tavily";
import { computeFitScore, FIT_SCORE_DISCARD_THRESHOLD } from "./scoring";

export type LeadSector = "commercial_bd_target" | "institutional_pipeline";
export type LeadState = "GA" | "FL";

export interface DiscoveredLead {
  title: string;
  description: string | null;
  organizations: { name: string; role: string }[];
  estimatedValue: number | null;
  location: string | null;
  whyBttFits: string | null;
  sourceUrl: string;
  fitScore: number;
}

const QUERY_MATRIX: Record<LeadState, Record<LeadSector, string[]>> = {
  FL: {
    commercial_bd_target: [
      "Jacksonville Florida commercial construction permit office buildout 2026",
      "Jacksonville Florida hotel renovation amenity space project",
      "Jacksonville Florida new branch office interior build-out",
      "Northeast Florida adaptive reuse commercial building redevelopment",
    ],
    institutional_pipeline: [
      "University of North Florida campus facilities renovation plan",
      "Jacksonville Duval County Public Schools facilities capital plan renovation",
      "Jacksonville Aviation Authority facilities architect selection",
    ],
  },
  GA: {
    commercial_bd_target: [
      "Georgia commercial construction permit office buildout 2026",
      "Atlanta Georgia hotel renovation amenity space project",
      "Georgia new branch office interior build-out expansion",
      "Georgia adaptive reuse commercial building redevelopment",
    ],
    institutional_pipeline: [
      "Georgia university campus facilities renovation capital plan",
      "Georgia school district facilities capital plan renovation architect selection",
      "Georgia state agency administration building renovation plan",
    ],
  },
};

const MAX_RESULTS_PER_QUERY = 5;
const MAX_FINALISTS_PER_SECTOR = 12;

interface DiscoveryUsage {
  searchRequests: number;
}

async function runSearches(queries: string[], usage: DiscoveryUsage): Promise<Map<string, TavilyResult>> {
  const byUrl = new Map<string, TavilyResult>();
  for (const query of queries) {
    const results = await tavilySearch(process.env.TAVILY_API_KEY!, query, MAX_RESULTS_PER_QUERY);
    usage.searchRequests += 1;
    for (const r of results) if (!byUrl.has(r.url)) byUrl.set(r.url, r);
  }
  return byUrl;
}

const EXTRACTION_SYSTEM_PROMPT = `You are helping an interior design and furniture-procurement firm (Below the Trusses, based in Jacksonville, FL, working across Florida and Georgia) find business development leads from raw web search results.

You will receive a JSON array of candidate search results (title, url, content snippet). For each one that describes a REAL, SPECIFIC project or organizational initiative relevant to interior design, furniture, office/commercial build-outs, renovations, or institutional facilities planning, extract structured fields. Skip candidates that are generic articles, directories, unrelated news, or too vague to act on (return fewer items than you were given if needed — do not force a match).

For each surviving candidate, return an object with:
- title: short project/initiative name
- description: 1-2 sentence factual summary of what's happening, using ONLY facts present in the source content — never invent details, dollar amounts, dates, or company names not present in the snippet
- organizations: array of {name, role} for any companies/firms mentioned (e.g. {"name": "Avant Construction", "role": "GC"}) — empty array if none named
- estimatedValue: a number (USD) ONLY if an explicit dollar figure is in the source text, otherwise null
- location: city/area if identifiable, otherwise null
- whyBttFits: one sentence on why this could be relevant to an interior design/furniture firm — grounded in the actual project type, not generic

Return ONLY a JSON array, no other text. Each object must also include the original "url" field unchanged from its input so it can be matched back.`;

async function extractLeads(
  candidates: TavilyResult[],
  sector: LeadSector,
  state: LeadState,
  usage: DiscoveryUsage & { aiSummaryCalls: number }
): Promise<Omit<DiscoveredLead, "fitScore">[]> {
  if (candidates.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — cannot run AI extraction step");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          sector,
          state,
          candidates: candidates.map((c) => ({ title: c.title, url: c.url, content: c.content.slice(0, 1500) })),
        }),
      },
    ],
  });
  usage.aiSummaryCalls += 1;

  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text")?.text ?? "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: Array<{
    title: string;
    description: string | null;
    organizations: { name: string; role: string }[];
    estimatedValue: number | null;
    location: string | null;
    whyBttFits: string | null;
    url: string;
  }>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  return parsed
    .filter((p) => candidates.some((c) => c.url === p.url))
    .map((p) => ({
      title: p.title,
      description: p.description,
      organizations: p.organizations ?? [],
      estimatedValue: p.estimatedValue,
      location: p.location,
      whyBttFits: p.whyBttFits,
      sourceUrl: p.url,
    }));
}

/** Runs the full search -> dedupe -> score -> discard -> extract pipeline for one sector/state. */
export async function discoverLeads(
  sector: LeadSector,
  state: LeadState,
  usage: DiscoveryUsage & { aiSummaryCalls: number }
): Promise<DiscoveredLead[]> {
  const queries = QUERY_MATRIX[state][sector];
  const byUrl = await runSearches(queries, usage);

  const scored = Array.from(byUrl.values())
    .map((r) => ({ result: r, score: computeFitScore(`${r.title} ${r.content}`) }))
    .filter((r) => r.score >= FIT_SCORE_DISCARD_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FINALISTS_PER_SECTOR);

  const scoreByUrl = new Map(scored.map((r) => [r.result.url, r.score]));
  const extracted = await extractLeads(
    scored.map((r) => r.result),
    sector,
    state,
    usage
  );

  return extracted.map((e) => ({ ...e, fitScore: scoreByUrl.get(e.sourceUrl) ?? FIT_SCORE_DISCARD_THRESHOLD }));
}
