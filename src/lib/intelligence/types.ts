export type Severity = "critical" | "high" | "medium" | "low";

export type RecommendationStatus = "active" | "dismissed" | "snoozed" | "handled" | "resolved";

export type IntelligencePeriod = "today" | "week" | "month";

/**
 * A deterministically-computed fact about a canonical BTT record. Pure data —
 * no persistence, no AI. `conditionFingerprint` must be built only from the
 * business fields that define the condition (see fingerprint.ts) so the
 * recommendations table's upsert lifecycle can tell "still the same issue"
 * apart from "materially changed" without ever looking at generated text.
 */
export interface Signal {
  type: string;
  sourceTable: string;
  sourceId: string;
  title: string;
  reason: string;
  severity: Severity;
  conditionFingerprint: string;
  metricValue: number | null;
  metricLabel: string | null;
  context: Record<string, unknown>;
}
