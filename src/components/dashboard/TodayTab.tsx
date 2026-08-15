"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecommendationRow } from "@/lib/intelligence/queries";
import { topPriorities } from "@/lib/intelligence/rank";
import { toIsoDate } from "@/lib/hours/dates";

type SubPeriod = "today" | "week" | "month";
type Urgency = "red" | "yellow" | "green";

/**
 * Presentation-only urgency, separate from the stored `severity` (which
 * still drives ranking/lifecycle persistence). Date-driven items map
 * directly to when they're due; everything else falls back to severity.
 * One consistent 3-color scale across every recommendation type, per the
 * owner's request for "a key for colors so we know what they mean."
 */
function urgencyOf(rec: RecommendationRow): Urgency {
  switch (rec.type) {
    case "milestone_overdue":
      return "red";
    case "milestone_due_this_week":
      return "yellow";
    case "milestone_due_this_month":
      return "green";
    case "contractor_hours_pending":
      return rec.severity === "high" ? "red" : "yellow";
    case "aging_sow":
      return rec.context.closeoutSuggested ? "red" : rec.severity === "high" ? "yellow" : "green";
    default:
      return rec.severity === "critical" ? "red" : rec.severity === "high" ? "yellow" : "green";
  }
}

const URGENCY_STYLE: Record<Urgency, { border: string; text: string; dot: string }> = {
  red: { border: "border-l-warning", text: "text-warning", dot: "bg-warning" },
  yellow: { border: "border-l-brand-accent", text: "text-brand-accent", dot: "bg-brand-accent" },
  green: { border: "border-l-positive", text: "text-positive", dot: "bg-positive" },
};

const URGENCY_LABEL: Record<Urgency, string> = { red: "Act Now", yellow: "This Week", green: "This Month" };

function ColorKey() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 border border-line bg-surface px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Key</span>
      {(["red", "yellow", "green"] as Urgency[]).map((u) => (
        <span key={u} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${URGENCY_STYLE[u].dot}`} />
          <span className="text-xs text-ink/70">
            {URGENCY_LABEL[u]}
            {u === "red" ? " — overdue or needs a decision" : u === "yellow" ? " — due within 7 days" : " — due later this month, on your radar"}
          </span>
        </span>
      ))}
    </div>
  );
}

function openHref(rec: RecommendationRow): string {
  const projectId = typeof rec.context.projectId === "string" ? rec.context.projectId : null;
  switch (rec.sourceTable) {
    case "leads":
      return "/?tab=leads";
    case "sow_sent":
      return "/?tab=sow";
    case "milestones":
      return projectId ? `/projects/${projectId}` : "/?tab=projects";
    case "projects":
      return `/projects/${rec.sourceId}`;
    case "subcontractor_time_entries":
      return "/?tab=contracted";
    default:
      return "/";
  }
}

async function logActivity(
  supabase: ReturnType<typeof createClient>,
  params: {
    entityTable: string;
    entityId: string;
    eventType: string;
    summary: string;
    priorValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    recommendationId: string;
  }
) {
  await supabase.from("activity_events").insert({
    entity_table: params.entityTable,
    entity_id: params.entityId,
    event_type: params.eventType,
    summary: params.summary,
    prior_value: params.priorValue ?? null,
    new_value: params.newValue ?? null,
    source: "today",
    recommendation_id: params.recommendationId,
  });
}

export function TodayTab({ recommendations: initial }: { recommendations: RecommendationRow[] }) {
  const [period, setPeriod] = useState<SubPeriod>("today");
  const [recommendations, setRecommendations] = useState(initial);
  const router = useRouter();

  function remove(id: string) {
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  const top = useMemo(() => topPriorities(recommendations, 5), [recommendations]);
  const rest = useMemo(() => {
    const topIds = new Set(top.map((r) => r.id));
    return recommendations.filter((r) => !topIds.has(r.id));
  }, [recommendations, top]);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
        <h2 className="text-lg font-normal">Priorities</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">What Should We Do?</span>
      </div>

      <nav className="mb-6 flex gap-1">
        {(["today", "week", "month"] as SubPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wide ${
              period === p ? "bg-brand-primary text-white" : "border border-ink text-ink hover:bg-canvas"
            }`}
          >
            {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
          </button>
        ))}
      </nav>

      {period === "today" && (
        <>
          <ColorKey />

          <section className="mb-8">
            <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Top Priorities Today</h3>
            {top.length === 0 ? (
              <div className="border border-line bg-surface p-4 text-sm text-ink/50">
                Nothing needs attention right now — check back tomorrow.
              </div>
            ) : (
              <div className="space-y-2">
                {top.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={remove} router={router} />
                ))}
              </div>
            )}
          </section>

          {rest.length > 0 && (
            <section>
              <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">
                Also Worth a Look ({rest.length})
              </h3>
              <div className="space-y-2">
                {rest.map((rec) => (
                  <RecommendationCard key={rec.id} rec={rec} onHandled={remove} router={router} compact />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {period === "week" && <WeekPlaceholder recommendations={recommendations} />}
      {period === "month" && <MonthPlaceholder recommendations={recommendations} />}
    </div>
  );
}

function RecommendationCard({
  rec,
  onHandled,
  router,
  compact,
}: {
  rec: RecommendationRow;
  onHandled: (id: string) => void;
  router: ReturnType<typeof useRouter>;
  compact?: boolean;
}) {
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState("");
  const [busy, setBusy] = useState(false);
  const urgency = urgencyOf(rec);

  async function dismiss() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString(), fingerprint_at_action: null, severity_at_action: rec.severity })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_dismissed",
        summary: `Dismissed: ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  async function snooze() {
    if (!snoozeDate) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({ status: "snoozed", snoozed_until: snoozeDate, fingerprint_at_action: null, severity_at_action: rec.severity })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_snoozed",
        summary: `Snoozed until ${snoozeDate}: ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  async function markHandled(actionTaken: string) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("recommendations")
      .update({
        status: "handled",
        handled_at: new Date().toISOString(),
        action_taken: actionTaken,
        fingerprint_at_action: null,
        severity_at_action: rec.severity,
      })
      .eq("id", rec.id);
    setBusy(false);
    if (!error) {
      await logActivity(supabase, {
        entityTable: "recommendations",
        entityId: rec.id,
        eventType: "recommendation_handled",
        summary: `Marked handled (${actionTaken}): ${rec.title}`,
        recommendationId: rec.id,
      });
      onHandled(rec.id);
    }
  }

  // Canonical-record actions — the underlying business row updates, not just the recommendation.
  async function markLeadContacted() {
    setBusy(true);
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const { error } = await supabase.from("leads").update({ last_contacted_date: today }).eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "leads",
      entityId: rec.sourceId,
      eventType: "lead_contacted",
      summary: "Marked contacted from Today",
      newValue: { last_contacted_date: today },
      recommendationId: rec.id,
    });
    await markHandled("marked_contacted");
    router.refresh();
  }

  async function markMilestonePaid() {
    setBusy(true);
    const supabase = createClient();
    const today = toIsoDate(new Date());
    const outstanding = typeof rec.context.outstanding === "number" ? rec.context.outstanding : rec.metricValue ?? 0;
    const { data: milestone } = await supabase.from("milestones").select("amount_due, amount_paid").eq("id", rec.sourceId).maybeSingle();
    if (!milestone) {
      setBusy(false);
      return;
    }
    const newAmountPaid = (milestone.amount_paid ?? 0) + outstanding;
    const { error } = await supabase
      .from("milestones")
      .update({ paid_date: today, amount_paid: newAmountPaid, status: "Paid" })
      .eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "milestones",
      entityId: rec.sourceId,
      eventType: "milestone_paid",
      summary: "Marked paid from Today",
      priorValue: { amount_paid: milestone.amount_paid },
      newValue: { amount_paid: newAmountPaid, status: "Paid" },
      recommendationId: rec.id,
    });
    await markHandled("marked_paid");
    router.refresh();
  }

  async function suggestDecline() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("sow_sent").update({ status: "Declined" }).eq("id", rec.sourceId);
    if (error) {
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      entityTable: "sow_sent",
      entityId: rec.sourceId,
      eventType: "sow_declined",
      summary: "Closed out as Declined from Today (no response, unlikely to convert)",
      newValue: { status: "Declined" },
      recommendationId: rec.id,
    });
    await markHandled("declined");
    router.refresh();
  }

  const isMilestone = rec.type === "milestone_overdue" || rec.type === "milestone_due_this_week" || rec.type === "milestone_due_this_month";
  const closeoutSuggested = rec.type === "aging_sow" && rec.context.closeoutSuggested === true;

  return (
    <div className={`border border-line border-l-4 bg-surface p-3 ${URGENCY_STYLE[urgency].border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-wide ${URGENCY_STYLE[urgency].text}`}>
              {URGENCY_LABEL[urgency]}
            </span>
            <span className={compact ? "text-sm" : "text-[15px]"}>{rec.title}</span>
          </div>
          <p className="mt-1 text-xs text-ink/70">{rec.reason}</p>
        </div>
      </div>

      {snoozing ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={snoozeDate}
            onChange={(e) => setSnoozeDate(e.target.value)}
            className="border border-line px-2 py-1 text-xs"
          />
          <button onClick={snooze} disabled={busy || !snoozeDate} className="bg-brand-primary px-2 py-1 font-mono text-[10px] uppercase text-white disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setSnoozing(false)} className="font-mono text-[10px] uppercase text-ink/50 underline underline-offset-2">
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href={openHref(rec)} className="font-mono text-[10px] uppercase text-brand-primary underline underline-offset-2">
            Open
          </Link>
          {rec.type === "stale_lead" && (
            <button onClick={markLeadContacted} disabled={busy} className="font-mono text-[10px] uppercase text-positive underline underline-offset-2 disabled:opacity-50">
              Mark Contacted
            </button>
          )}
          {isMilestone && (
            <button onClick={markMilestonePaid} disabled={busy} className="font-mono text-[10px] uppercase text-positive underline underline-offset-2 disabled:opacity-50">
              Mark Paid
            </button>
          )}
          {closeoutSuggested && (
            <button onClick={suggestDecline} disabled={busy} className="font-mono text-[10px] uppercase text-warning underline underline-offset-2 disabled:opacity-50">
              Close Out (Decline)
            </button>
          )}
          <button onClick={() => markHandled("acknowledged")} disabled={busy} className="font-mono text-[10px] uppercase text-ink/60 underline underline-offset-2 disabled:opacity-50">
            Mark Handled
          </button>
          <button onClick={() => setSnoozing(true)} disabled={busy} className="font-mono text-[10px] uppercase text-ink/60 underline underline-offset-2 disabled:opacity-50">
            Snooze
          </button>
          <button onClick={dismiss} disabled={busy} className="font-mono text-[10px] uppercase text-ink/40 underline underline-offset-2 disabled:opacity-50">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function WeekPlaceholder({ recommendations }: { recommendations: RecommendationRow[] }) {
  const byType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recommendations) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [recommendations]);

  return (
    <section>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Top Moves This Week</h3>
      <div className="border border-line bg-surface p-4 text-sm text-ink/70">
        <p className="mb-3">
          This week's view reuses the same intelligence feed as Today, without the daily 5-item cap — full
          weekly-specific sections (Revenue &amp; Forecast, Sales Pipeline, Project Risk) are the next layer to
          build on this same architecture.
        </p>
        {byType.length === 0 ? (
          <p className="text-ink/50">No open items right now.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {byType.map(([type, count]) => (
              <li key={type}>
                {count} × {type.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function MonthPlaceholder({ recommendations }: { recommendations: RecommendationRow[] }) {
  const total = recommendations.length;
  const critical = recommendations.filter((r) => r.severity === "critical").length;

  return (
    <section>
      <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-ink/60">Monthly Review</h3>
      <div className="border border-line bg-surface p-4 text-sm text-ink/70">
        <p className="mb-3">
          Full monthly intelligence (trend analysis, forecast accuracy, referral concentration over time) builds on
          the same deterministic-facts-first service — this is a placeholder proving the shared architecture, not
          the finished view.
        </p>
        <p className="font-mono text-xs">
          {total} open recommendation{total === 1 ? "" : "s"}, {critical} critical.
        </p>
      </div>
    </section>
  );
}
