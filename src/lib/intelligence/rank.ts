import type { Severity, Signal } from "./types";

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

/** Highest severity first; within a severity, the larger metric (days overdue, dollars, etc.) first. */
export function rankSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return (b.metricValue ?? 0) - (a.metricValue ?? 0);
  });
}

/** "Top Priorities Today" — prefer ~5 genuinely important items over a wall of alerts. */
export function topPriorities(signals: Signal[], limit = 5): Signal[] {
  return rankSignals(signals).slice(0, limit);
}
