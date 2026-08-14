import type { Severity } from "./types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

interface Rankable {
  severity: Severity;
  metricValue: number | null;
}

/** Highest severity first; within a severity, the larger metric (days overdue, dollars, etc.) first. Works on both fresh Signals and stored RecommendationRows — anything with severity + metricValue. */
export function rankSignals<T extends Rankable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return (b.metricValue ?? 0) - (a.metricValue ?? 0);
  });
}

/** "Top Priorities Today" — prefer ~5 genuinely important items over a wall of alerts. */
export function topPriorities<T extends Rankable>(items: T[], limit = 5): T[] {
  return rankSignals(items).slice(0, limit);
}
