import type { RecommendationStatus, Severity } from "./types";

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface ExistingRecommendationState {
  status: RecommendationStatus;
  fingerprintAtAction: string | null;
  severityAtAction: Severity | null;
  snoozedUntil: string | null; // date-only ISO string
}

export interface LifecycleDecision {
  /** What `status` should become once this run reconfirms the condition. */
  nextStatus: RecommendationStatus;
  /** Whether this is a lifecycle restart — clears action timestamps, worth an activity_event. */
  restarted: boolean;
  reason: string;
}

/**
 * Decides what happens to an existing recommendation row when the generator
 * reconfirms its underlying condition still holds. Only called when a
 * matching (type, source_table, source_id) fact was produced this run —
 * see `reconcileMissing` for the opposite case (a fact that stopped firing).
 *
 * Dismissed/handled: any fingerprint change restarts the lifecycle — this is
 * the case severity-only comparison can't catch (same severity, genuinely
 * different situation, or the same issue recurring after being handled).
 * Snoozed: only wakes early on a *severity escalation*, not just any
 * fingerprint change — a snooze is a deliberate "don't bother me about this
 * specific thing right now," not "don't bother me unless anything changes."
 */
export function decideLifecycle(
  existing: ExistingRecommendationState,
  newFingerprint: string,
  newSeverity: Severity,
  asOf: Date
): LifecycleDecision {
  const fingerprintChanged =
    existing.fingerprintAtAction !== null && existing.fingerprintAtAction !== newFingerprint;

  switch (existing.status) {
    case "active":
      return { nextStatus: "active", restarted: false, reason: "still active" };

    case "resolved":
      return { nextStatus: "active", restarted: true, reason: "condition seen again after being resolved" };

    case "dismissed":
    case "handled":
      if (fingerprintChanged) {
        return { nextStatus: "active", restarted: true, reason: "condition changed since last action" };
      }
      return { nextStatus: existing.status, restarted: false, reason: "same condition, preserving status" };

    case "snoozed": {
      const stillSnoozed = existing.snoozedUntil !== null && new Date(`${existing.snoozedUntil}T00:00:00Z`) > asOf;
      if (!stillSnoozed) {
        return { nextStatus: "active", restarted: true, reason: "snooze period elapsed" };
      }
      const severityEscalated =
        fingerprintChanged &&
        existing.severityAtAction !== null &&
        SEVERITY_RANK[newSeverity] > SEVERITY_RANK[existing.severityAtAction];
      if (severityEscalated) {
        return { nextStatus: "active", restarted: true, reason: "materially more urgent while snoozed" };
      }
      return { nextStatus: "snoozed", restarted: false, reason: "still within snooze window" };
    }
  }
}

/** For a row not reconfirmed by the current run — the deterministic condition no longer holds. */
export function reconcileMissing(status: RecommendationStatus): RecommendationStatus {
  return status === "active" || status === "snoozed" ? "resolved" : status;
}
