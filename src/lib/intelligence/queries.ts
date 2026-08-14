import { createClient } from "@/lib/supabase/server";
import { getAllMilestonesForIntelligence } from "@/lib/projects/queries";
import type { Lead } from "@/lib/leads/types";
import type { DashboardData } from "@/lib/dashboard/types";
import type { ProjectListItem } from "@/lib/projects/types";
import {
  agingSowSignals,
  forecastConcentrationSignal,
  outstandingBalanceSignals,
  overdueMilestoneSignals,
  staleLeadSignals,
  upcomingMilestoneSignals,
} from "./facts";
import { decideLifecycle, reconcileMissing } from "./lifecycle";
import { rankSignals } from "./rank";
import type { RecommendationStatus, Severity, Signal } from "./types";

export interface RecommendationRow {
  id: string;
  type: string;
  sourceTable: string;
  sourceId: string;
  title: string;
  reason: string;
  severity: Severity;
  metricValue: number | null;
  metricLabel: string | null;
  context: Record<string, unknown>;
  generatedAt: string;
}

/**
 * Inputs the intelligence layer needs that `page.tsx` (or any other caller)
 * has typically already fetched for its own rendering — passed in rather
 * than re-queried, so a Today page load doesn't duplicate the leads/
 * dashboard/projects queries the rest of the dashboard already runs.
 * `milestones` is the one genuinely new query (no existing caller fetches
 * all milestones across all projects), fetched here if not supplied.
 */
export interface IntelligenceInputs {
  leads: Lead[];
  dashboardData: DashboardData;
  projects: ProjectListItem[];
}

function computeSignals(inputs: IntelligenceInputs, milestones: Awaited<ReturnType<typeof getAllMilestonesForIntelligence>>, now: Date): Signal[] {
  const currentYear = now.getFullYear();

  const signals: Signal[] = [
    ...staleLeadSignals(inputs.leads, now),
    ...agingSowSignals(inputs.dashboardData.sow, now),
    ...overdueMilestoneSignals(milestones, now),
    ...upcomingMilestoneSignals(milestones, now),
    ...outstandingBalanceSignals(inputs.projects),
  ];

  const forecastSignal = forecastConcentrationSignal(inputs.dashboardData.forecast, currentYear);
  if (forecastSignal) signals.push(forecastSignal);

  return signals;
}

interface ExistingRow {
  id: string;
  type: string;
  source_table: string;
  source_id: string;
  status: RecommendationStatus;
  fingerprint_at_action: string | null;
  severity_at_action: Severity | null;
  snoozed_until: string | null;
}

/**
 * Regenerates recommendations from current canonical data, then returns
 * every currently-active one, ranked. Upserts on (type, source_table,
 * source_id) per the fingerprint lifecycle rules in lifecycle.ts, then
 * resolves any previously active/snoozed row whose condition no longer
 * fires. Safe to call on every Today/Week/Month page load — never creates
 * duplicates, never silently discards a dismiss/snooze/handle decision.
 */
export async function getActiveRecommendations(inputs: IntelligenceInputs): Promise<RecommendationRow[]> {
  const supabase = await createClient();
  const now = new Date();
  const milestones = await getAllMilestonesForIntelligence();
  const signals = computeSignals(inputs, milestones, now);

  const { data: existingRows, error: fetchError } = await supabase
    .from("recommendations")
    .select("id, type, source_table, source_id, status, fingerprint_at_action, severity_at_action, snoozed_until");
  if (fetchError) throw new Error(`recommendations: ${fetchError.message}`);

  const existingByKey = new Map<string, ExistingRow>(
    (existingRows ?? []).map((r) => [`${r.type}::${r.source_table}::${r.source_id}`, r])
  );
  const seenKeys = new Set<string>();

  for (const signal of signals) {
    const key = `${signal.type}::${signal.sourceTable}::${signal.sourceId}`;
    seenKeys.add(key);
    const existing = existingByKey.get(key);

    if (!existing) {
      const { error } = await supabase.from("recommendations").insert({
        type: signal.type,
        source_table: signal.sourceTable,
        source_id: signal.sourceId,
        title: signal.title,
        reason: signal.reason,
        severity: signal.severity,
        condition_fingerprint: signal.conditionFingerprint,
        metric_value: signal.metricValue,
        metric_label: signal.metricLabel,
        context: signal.context,
        status: "active",
        generated_at: now.toISOString(),
        last_seen_at: now.toISOString(),
      });
      if (error) throw new Error(`recommendations insert: ${error.message}`);
      continue;
    }

    const decision = decideLifecycle(
      {
        status: existing.status,
        fingerprintAtAction: existing.fingerprint_at_action,
        severityAtAction: existing.severity_at_action,
        snoozedUntil: existing.snoozed_until,
      },
      signal.conditionFingerprint,
      signal.severity,
      now
    );

    const patch: Record<string, unknown> = {
      title: signal.title,
      reason: signal.reason,
      severity: signal.severity,
      condition_fingerprint: signal.conditionFingerprint,
      metric_value: signal.metricValue,
      metric_label: signal.metricLabel,
      context: signal.context,
      generated_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      status: decision.nextStatus,
    };
    if (decision.restarted) {
      Object.assign(patch, {
        dismissed_at: null,
        handled_at: null,
        resolved_at: null,
        snoozed_until: null,
        fingerprint_at_action: null,
        severity_at_action: null,
        action_taken: null,
        action_taken_by: null,
      });
    }

    const { error } = await supabase.from("recommendations").update(patch).eq("id", existing.id);
    if (error) throw new Error(`recommendations update: ${error.message}`);

    if (decision.restarted) {
      await supabase.from("activity_events").insert({
        entity_table: "recommendations",
        entity_id: existing.id,
        event_type: "recommendation_resurfaced",
        summary: `Recommendation resurfaced: ${decision.reason}`,
        source: "system",
        recommendation_id: existing.id,
      });
    }
  }

  // Reconcile: rows not reconfirmed this run whose condition no longer holds.
  for (const [key, row] of existingByKey) {
    if (seenKeys.has(key)) continue;
    const nextStatus = reconcileMissing(row.status);
    if (nextStatus === row.status) continue;
    const { error } = await supabase
      .from("recommendations")
      .update({ status: nextStatus, resolved_at: now.toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(`recommendations resolve: ${error.message}`);
  }

  const { data, error } = await supabase
    .from("recommendations")
    .select("id, type, source_table, source_id, title, reason, severity, metric_value, metric_label, context, generated_at")
    .eq("status", "active");
  if (error) throw new Error(`recommendations: ${error.message}`);

  const rows: RecommendationRow[] = (data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    sourceTable: r.source_table,
    sourceId: r.source_id,
    title: r.title,
    reason: r.reason,
    severity: r.severity as Severity,
    metricValue: r.metric_value,
    metricLabel: r.metric_label,
    context: (r.context ?? {}) as Record<string, unknown>,
    generatedAt: r.generated_at,
  }));

  return rankSignals(rows);
}
